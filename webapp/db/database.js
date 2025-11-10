const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
});

// ---------- helpers ----------
const idColumnFor = (table) =>
  table === 'employees' ? 'employeeid' :
  table === 'menuitems' ? 'itemid'    : 'inventoryid';

// ---------- generic API ----------
async function getAll(table) {
  const result = await pool.query(`SELECT * FROM ${table}`);
  return result.rows;
}

async function updateItem(table, id, fields) {
  const keys = Object.keys(fields);
  const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.values(fields);
  const idCol = idColumnFor(table);
  await pool.query(
    `UPDATE ${table} SET ${setString} WHERE ${idCol} = $${values.length + 1}`,
    [...values, id]
  );
}

async function addItem(table, data) {
  const columnMap = {
    menuitems: ['itemname', 'itemdescription', 'itemprice'],
    inventory: ['ingredientname', 'ingredientquantity', 'unit'],
    employees: ['employeename'],
  };
  const validColumns = columnMap[table];
  if (!validColumns) throw new Error(`Unknown table: ${table}`);

  const filtered = {};
  for (const col of validColumns) {
    if (data[col] !== undefined) {
      filtered[col] = ['itemprice', 'ingredientquantity'].includes(col)
        ? Number(data[col]) || 0
        : data[col] || null;
    }
  }
  const cols = Object.keys(filtered);
  if (!cols.length) throw new Error('No valid data to insert');

  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const result = await pool.query(query, Object.values(filtered));
  return result.rows[0];
}

async function deleteItem(table, id) {
  const idCol = idColumnFor(table);
  if (table === 'menuitems') await deleteRecipesByMenuItem(id);
  await pool.query(`DELETE FROM ${table} WHERE ${idCol} = $1`, [id]);
}

async function addRecipe(data) {
  const q = `
    INSERT INTO recipes (itemid, inventoryid, quantity, unit)
    VALUES ($1, $2, $3, $4) RETURNING *`;
  const vals = [
    Number(data.itemid),
    Number(data.inventoryid),
    Number(data.quantity),
    data.unit || ''
  ];
  const result = await pool.query(q, vals);
  return result.rows[0];
}

async function updateRecipe(id, fields) {
  const keys = Object.keys(fields);
  const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.values(fields);
  await pool.query(
    `UPDATE recipes SET ${setString} WHERE recipeid = $${values.length + 1}`,
    [...values, id]
  );
}

async function deleteRecipe(id) {
  await pool.query('DELETE FROM recipes WHERE recipeid = $1', [id]);
}
async function deleteRecipesByMenuItem(itemId) {
  await pool.query('DELETE FROM recipes WHERE itemid = $1', [itemId]);
}

// ====================================================================
// NEW: Create order (+ orderitems) AND deduct inventory in one txn
// cartItems: [{ drink, quantity, iceLevel, sugarLevel, toppings[] }]
// toppings are charged $1 each for total calculation here (same as UI).
// Writes into tables with quoted column names: "orders", "orderitems".
// ====================================================================
async function createOrderAndDeductInventory(cartItems, { employeeId = 0, customerId = 0 } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Resolve menu items (id + price) in one go
    const names = cartItems.map(i => i.drink);
    const { rows: menuRows } = await client.query(
      `SELECT itemid, itemname, itemprice
         FROM menuitems
        WHERE itemname = ANY($1::text[])`,
      [names]
    );
    const byName = new Map(menuRows.map(r => [r.itemname, r]));

    // 2) Build need map for inventory and compute order total
    const needMap = new Map(); // inventoryid -> need total
    const shortages = [];

    // Helper: add needed quantity to needMap
    const addNeed = (invId, qty) => {
      const prev = needMap.get(invId) || 0;
      needMap.set(invId, prev + qty);
    };

    // compute monetary total (no tax in DB total — matches prior rows)
    let orderTotal = 0;

    for (const line of cartItems) {
      const qty = Number(line.quantity || 1);
      const rec = byName.get(line.drink);
      if (!rec) {
        shortages.push({ drink: line.drink, reason: 'menu item not found' });
        continue;
      }

      const base = Number(rec.itemprice || 0);
      const toppingCount = Array.isArray(line.toppings) ? line.toppings.length : 0;
      const lineTotal = (base + toppingCount * 1.0) * qty;
      orderTotal += lineTotal;

      // pull recipe rows and accumulate ingredient needs
      const { rows: recipeRows } = await client.query(
        `SELECT inventoryid, quantity
           FROM recipes
          WHERE itemid = $1`,
        [rec.itemid]
      );
      for (const rr of recipeRows) {
        addNeed(rr.inventoryid, Number(rr.quantity) * qty);
      }
    }

    // If any missing menu item => fail early
    if (shortages.length) {
      await client.query('ROLLBACK');
      return { ok: false, shortages };
    }

    // 3) Check inventory sufficiency
    const invIds = Array.from(needMap.keys());
    if (invIds.length) {
      const { rows: invRows } = await client.query(
        `SELECT inventoryid, ingredientname, ingredientquantity
           FROM inventory
          WHERE inventoryid = ANY($1::int[])`,
        [invIds]
      );
      const invMap = new Map(invRows.map(r => [r.inventoryid, r]));
      for (const invId of invIds) {
        const need = needMap.get(invId);
        const have = Number(invMap.get(invId)?.ingredientquantity ?? 0);
        if (have < need) {
          const ing = invMap.get(invId)?.ingredientname || `#${invId}`;
          shortages.push({ ingredientid: invId, ingredient: ing, need, have });
        }
      }
      if (shortages.length) {
        await client.query('ROLLBACK');
        return { ok: false, shortages };
      }
    }

    // 4) Insert INTO "orders"
    // Columns: "Customer ID","Employee ID","Order Date","Total Amount"
    const { rows: orderIns } = await client.query(
      `INSERT INTO public.orders
        ("Customer ID","Employee ID","Order Date","Total Amount")
       VALUES ($1,$2,NOW(),$3)
       RETURNING "Order ID"`,
      [customerId, employeeId, orderTotal]
    );
    const orderId = orderIns[0]['Order ID'];

    // 5) Insert order items + (after) deduct inventory
    for (const line of cartItems) {
      const qty = Number(line.quantity || 1);
      const rec = byName.get(line.drink);
      if (!rec) continue;

      // orderitems columns:
      // "Order ID","Item ID","Quantity","Order Size",
      // "Order Topping","Order Sugar Level","Order Ice Level"
      const toppingsStr = Array.isArray(line.toppings) && line.toppings.length
        ? line.toppings.join(', ')
        : null;

      await client.query(
        `INSERT INTO public.orderitems
          ("Order ID","Item ID","Quantity","Order Size",
           "Order Topping","Order Sugar Level","Order Ice Level")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          orderId,
          rec.itemid,
          qty,
          null,                       // no size in current UI
          toppingsStr,
          line.sugarLevel || null,
          line.iceLevel || null
        ]
      );
    }

    // 6) Deduct inventory
    for (const invId of invIds) {
      const need = needMap.get(invId);
      await client.query(
        `UPDATE inventory
            SET ingredientquantity = ingredientquantity - $1
          WHERE inventoryid = $2`,
        [need, invId]
      );
    }

    await client.query('COMMIT');
    return { ok: true, orderId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// (kept for legacy calls that only deduct)
async function applyOrderAndDeductInventory(cartItems) {
  // You can keep your existing implementation here if other parts still use it
  return createOrderAndDeductInventory(cartItems); // optional: route all through new one
}

module.exports = {
  pool,
  getAll,
  updateItem,
  addItem,
  deleteItem,
  addRecipe,
  updateRecipe,
  deleteRecipe,
  deleteRecipesByMenuItem,
  // new
  createOrderAndDeductInventory,
  applyOrderAndDeductInventory,
};
