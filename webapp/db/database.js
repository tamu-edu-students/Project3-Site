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
  table === 'menuitems' ? 'itemid' : 'inventoryid';

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

// ---------- existing domain logic for checkout (inventory only) ----------
/**
 * cartItems: [{ drink: 'Classic Milk Tea', quantity: 2 }]
 * Deducts inventory based on recipes for each drink.
 */
async function applyOrderAndDeductInventory(cartItems) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get menu item ids for all drinks in one shot
    const names = cartItems.map(i => i.drink);
    const { rows: items } = await client.query(
      `SELECT itemid, itemname FROM menuitems WHERE itemname = ANY($1::text[])`,
      [names]
    );
    const nameToId = new Map(items.map(r => [r.itemname, r.itemid]));

    // Shortage accumulation
    const shortages = [];
    const updates = [];

    // Build required ingredient totals
    // map inventoryid -> {need}
    const needMap = new Map();

    for (const line of cartItems) {
      const itemId = nameToId.get(line.drink);
      if (!itemId) {
        shortages.push({ drink: line.drink, reason: 'menu item not found' });
        continue;
      }
      const { rows: recipeRows } = await client.query(
        `SELECT inventoryid, quantity, unit
         FROM recipes WHERE itemid = $1`,
        [itemId]
      );

      for (const r of recipeRows) {
        const needed = Number(r.quantity) * Number(line.quantity || 1);
        const prev = needMap.get(r.inventoryid) || { need: 0 };
        needMap.set(r.inventoryid, { need: prev.need + needed });
      }
    }

    // Fetch current inventory for all required ids
    const invIds = Array.from(needMap.keys());
    if (invIds.length) {
      const { rows: invRows } = await client.query(
        `SELECT inventoryid, ingredientname, ingredientquantity
         FROM inventory WHERE inventoryid = ANY($1::int[])`,
        [invIds]
      );
      const invMap = new Map(invRows.map(r => [r.inventoryid, r]));

      // Check shortages
      for (const invId of invIds) {
        const need = needMap.get(invId).need;
        const invRow = invMap.get(invId);
        const have = Number(invRow?.ingredientquantity ?? 0);
        if (have < need) {
          shortages.push({
            ingredientid: invId,
            ingredient: invRow?.ingredientname || `#${invId}`,
            need, have
          });
        }
      }

      // If any shortage, rollback and report
      if (shortages.length) {
        await client.query('ROLLBACK');
        return { shortages };
      }

      // Deduct
      for (const invId of invIds) {
        const need = needMap.get(invId).need;
        updates.push({ invId, need });
        await client.query(
          `UPDATE inventory
             SET ingredientquantity = ingredientquantity - $1
           WHERE inventoryid = $2`,
          [need, invId]
        );
      }
    }

    await client.query('COMMIT');
    return { updated: updates, shortages: [] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------- NEW: create order + orderitems + deduct inventory (all in one txn) ----------
/**
 * cartItems: [{
 *   drink: string,
 *   quantity: number,
 *   toppings: string[],
 *   iceLevel?: string,
 *   sugarLevel?: string
 * }]
 * options: { customerId?: number, employeeId?: number }
 * Returns: { orderId, totalAmount }
 */
async function createOrderWithItems(cartItems, options = {}) {
  const customerId = Number(options.customerId ?? 0);
  const employeeId = Number(options.employeeId ?? 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Resolve menu items and prices
    const names = cartItems.map(i => i.drink);
    const { rows: items } = await client.query(
      `SELECT itemid, itemname, itemprice
       FROM menuitems
       WHERE itemname = ANY($1::text[])`,
      [names]
    );
    const nameToMenu = new Map(items.map(r => [r.itemname, r])); // {itemid,itemname,itemprice}

    // 2) Build required ingredient totals (same as applyOrderAndDeductInventory)
    const shortages = [];
    const needMap = new Map(); // invId -> { need }
    for (const line of cartItems) {
      const menu = nameToMenu.get(line.drink);
      if (!menu) {
        shortages.push({ drink: line.drink, reason: 'menu item not found' });
        continue;
      }
      const { rows: recipeRows } = await client.query(
        `SELECT inventoryid, quantity, unit
         FROM recipes
         WHERE itemid = $1`,
        [menu.itemid]
      );
      for (const r of recipeRows) {
        const needed = Number(r.quantity) * Number(line.quantity || 1);
        const prev = needMap.get(r.inventoryid) || { need: 0 };
        needMap.set(r.inventoryid, { need: prev.need + needed });
      }
    }

    // Shortage check
    const invIds = Array.from(needMap.keys());
    if (invIds.length) {
      const { rows: invRows } = await client.query(
        `SELECT inventoryid, ingredientname, ingredientquantity
         FROM inventory WHERE inventoryid = ANY($1::int[])`,
        [invIds]
      );
      const invMap = new Map(invRows.map(r => [r.inventoryid, r]));
      for (const invId of invIds) {
        const need = needMap.get(invId).need;
        const have = Number(invMap.get(invId)?.ingredientquantity ?? 0);
        if (have < need) {
          shortages.push({
            ingredientid: invId,
            ingredient: invMap.get(invId)?.ingredientname || `#${invId}`,
            need, have
          });
        }
      }
    }

    if (shortages.length) {
      await client.query('ROLLBACK');
      return { shortages };
    }

    // 3) Compute order total on the server:
    //    total = sum( (menu price + $1 * toppingsCount) * quantity )
    let totalAmount = 0;
    for (const line of cartItems) {
      const menu = nameToMenu.get(line.drink);
      if (!menu) continue; // already handled as shortage above
      const qty = Number(line.quantity || 1);
      const toppingCount = Array.isArray(line.toppings) ? line.toppings.length : 0;
      const unitPrice = Number(menu.itemprice) + toppingCount * 1.0;
      totalAmount += unitPrice * qty;
    }

    // 4) Insert into orders (quoted identifiers due to spaces)
    const { rows: newOrderRows } = await client.query(
      `INSERT INTO public.orders ("Customer ID", "Employee ID", "Order Date", "Total Amount")
       VALUES ($1, $2, NOW(), $3)
       RETURNING "Order ID"`,
      [customerId, employeeId, totalAmount]
    );
    const orderId = newOrderRows[0]['Order ID'];

    // 5) Insert each line into orderitems
    for (const line of cartItems) {
      const menu = nameToMenu.get(line.drink);
      if (!menu) continue;
      const qty = Number(line.quantity || 1);
      const size = null; // no size selection in UI; set null (or 'Regular' if you prefer)
      const toppingsText = (Array.isArray(line.toppings) && line.toppings.length)
        ? line.toppings.join(', ')
        : null;
      const sugar = line.sugarLevel || null;
      const ice   = line.iceLevel   || null;

      await client.query(
        `INSERT INTO public.orderitems (
           "Order ID", "Item ID", "Quantity", "Order Size",
           "Order Topping", "Order Sugar Level", "Order Ice Level"
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderId, menu.itemid, qty, size, toppingsText, sugar, ice]
      );
    }

    // 6) Deduct inventory
    for (const invId of invIds) {
      const need = needMap.get(invId).need;
      await client.query(
        `UPDATE inventory
           SET ingredientquantity = ingredientquantity - $1
         WHERE inventoryid = $2`,
        [need, invId]
      );
    }

    await client.query('COMMIT');
    return { orderId, totalAmount, shortages: [] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
  applyOrderAndDeductInventory,   // keep old one (if anything else uses it)
  createOrderWithItems,           // new one (orders + orderitems + inventory)
};
