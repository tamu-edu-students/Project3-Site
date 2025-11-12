const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
});

// helpers

const idColumnFor = (table) =>
  table === 'employees' ? 'employeeid' :
  table === 'menuitems' ? 'itemid'    : 'inventoryid';

// API
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
    employees: ['employeename', 'email', 'role'],
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

    //Resolve menu items (id + price) in one go
    const names = cartItems.map(i => i.drink);
    const { rows: menuRows } = await client.query(
      `SELECT itemid, itemname, itemprice
         FROM menuitems
        WHERE itemname = ANY($1::text[])`,
      [names]
    );
    const byName = new Map(menuRows.map(r => [r.itemname, r]));

    //Build need map for inventory and compute order total
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

    // Insert INTO "orders"
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
          null,                       
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

async function generalReport() {
  // 1️⃣ Total Sales
  const totalSalesResult = await pool.query('SELECT SUM("Total Amount") AS total_sales FROM orders');
  const total = totalSalesResult.rows.length > 0 && totalSalesResult.rows[0].total_sales
      ? parseFloat(totalSalesResult.rows[0].total_sales)
      : 0.0;
  const totalSales = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);

  // 2 Total Orders
  const totalOrdersResult = await pool.query('SELECT COUNT(*) AS total_orders FROM orders');
  const totalOrders = totalOrdersResult.rows.length > 0
      ? parseInt(totalOrdersResult.rows[0].total_orders, 10)
      : 0;

  // 3️ Peak Sales Hour
  const peakHourResult = await pool.query(`
      SELECT EXTRACT(HOUR FROM "Order Date") AS order_hour,
              COUNT(*) AS order_count
      FROM orders
      GROUP BY order_hour
      ORDER BY order_count DESC
      LIMIT 1
  `);

  let peakHour = "N/A";
  if (peakHourResult.rows.length > 0) {
      let hour24 = parseInt(peakHourResult.rows[0].order_hour, 10);
      let hour12 = hour24 % 12 || 12; // convert 0 → 12
      const amPm = hour24 < 12 ? "AM" : "PM";
      peakHour = `${hour12}:00 ${amPm}`;
  }

  // 4️ Most Popular Menu Item
  const popularDrinkResult = await pool.query(`
      SELECT m."itemname" AS menu_item,
              COUNT(*) AS times_ordered
      FROM orderitems oi
      JOIN menuitems m ON oi."Item ID" = m."itemid"
      GROUP BY m."itemname"
      ORDER BY times_ordered DESC
      LIMIT 1
  `);

  const popularDrink = popularDrinkResult.rows.length > 0
      ? popularDrinkResult.rows[0].menu_item
      : "N/A";

  // Return all data
  return {
      totalSales,
      totalOrders,
      peakHour,
      popularDrink
  };
}

async function inventoryReport(start = null, end = null) {
  try {
    // --- 1️⃣ Get current inventory ---
    const { rows: inventory } = await pool.query(`
      SELECT ingredientname, ingredientquantity, unit
      FROM inventory
      ORDER BY inventoryid ASC;
    `);

    // --- 2️⃣ If no time window, return basic stock report ---
    if (!start || !end) {
      return {
        reportGeneratedAt: new Date().toISOString(),
        timeWindow: null,
        items: inventory.map(i => ({
          ingredient: i.ingredientname,
          quantity_in_stock: parseFloat(i.ingredientquantity),
          total_used: 0,
          remaining: parseFloat(i.ingredientquantity),
          unit: i.unit
        }))
      };
    }

    // --- 3️⃣ Query total ingredient usage within given time window ---
    const usageSQL = `
      SELECT 
        i.ingredientname,
        COALESCE(SUM(r.quantity * oi."Quantity"), 0) AS total_used,
        i.unit
      FROM inventory i
      LEFT JOIN recipes r ON i.inventoryid = r.inventoryid
      LEFT JOIN orderitems oi ON r.itemid = oi."Item ID"
      LEFT JOIN orders o ON oi."Order ID" = o."Order ID"
      WHERE o."Order Date" BETWEEN $1 AND $2
      GROUP BY i.ingredientname, i.unit
      ORDER BY total_used DESC;
    `;

    const { rows: usage } = await pool.query(usageSQL, [start, end]);

    // --- 4️⃣ Combine inventory + usage data ---
    const reportItems = inventory.map(inv => {
      const use = usage.find(u => u.ingredientname === inv.ingredientname);
      const totalUsed = use ? parseFloat(use.total_used) : 0;
      const stock = parseFloat(inv.ingredientquantity);
      const remaining = Math.max(stock - totalUsed, 0);

      return {
        ingredient: inv.ingredientname,
        quantity_in_stock: stock,
        total_used: totalUsed,
        remaining,
        unit: inv.unit
      };
    });

    // --- 5️⃣ Return full report ---
    return {
      reportGeneratedAt: new Date().toISOString(),
      timeWindow: { start, end },
      items: reportItems
    };

  } catch (err) {
    console.error('❌ Error generating inventory report:', err);
    throw new Error('Failed to generate inventory report.');
  }
}

async function menuReport() {
  const menuSalesResult = await pool.query(`
    SELECT m.itemname, m.itemprice, COUNT(oi."Item ID") AS times_ordered
    FROM menuitems m
    LEFT JOIN orderitems oi ON m.itemid = oi."Item ID"
    GROUP BY m.itemname, m.itemprice
  `);

  return menuSalesResult.rows;

}

async function employeeReport() {
  const emplployeeSalesResult = await pool.query(`
    SELECT e.employeename, COUNT(o. "Order ID") AS orders_handled
    FROM employees e
    LEFT JOIN orders o ON e.employeeid = o."Employee ID"
    GROUP BY e.employeename
    `);

    return emplployeeSalesResult.rows;
}

async function getSalesBetween(start, end) {
  const sql = `
    SELECT 
      o."Order ID" AS order_id,
      o."Order Date" AS order_date,
      c.customer_name AS customer,
      o."Total Amount" AS total
    FROM orders o
    LEFT JOIN customers c ON o."Customer ID" = c.customer_id
    WHERE o."Order Date" BETWEEN $1 AND $2
    ORDER BY o."Order Date" ASC
  `;

  const result = await pool.query(sql, [start, end]);
  return result.rows; // returns an array of sale objects
}

async function getMostPopularMenuItem(start, end) {
  const sql = `
    SELECT m.itemname, COUNT(oi."Item ID") AS times_ordered
    FROM orders o
    JOIN orderitems oi ON o."Order ID" = oi."Order ID"
    JOIN menuitems m ON oi."Item ID" = m.itemid
    WHERE o."Order Date" BETWEEN $1 AND $2
    GROUP BY m.itemname
    ORDER BY times_ordered DESC
    LIMIT 1
  `;

  const result = await pool.query(sql, [start, end]);
  return result.rows.length > 0 ? result.rows[0].itemname : 'N/A';
}

async function getPeakSalesHour(start, end) {
  const sql = `
    SELECT TO_CHAR(o."Order Date", 'HH24') AS hour, COUNT(*) AS orders_in_hour
    FROM orders o
    WHERE o."Order Date" BETWEEN $1 AND $2
    GROUP BY hour
    ORDER BY orders_in_hour DESC
    LIMIT 1
  `;

  const result = await pool.query(sql, [start, end]);

  if (result.rows.length === 0) return 'N/A';

  const hour24 = parseInt(result.rows[0].hour, 10);
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  const amPm = hour24 < 12 ? 'AM' : 'PM';

  return `${hour12}:00 ${amPm}`;
}

module.exports = {
  createOrderAndDeductInventory,
  applyOrderAndDeductInventory,
  getAll, 
  updateItem, 
  addItem, 
  deleteItem, 
  addRecipe,
  updateRecipe,
  deleteRecipe,
  deleteRecipesByMenuItem,  
  generalReport,
  inventoryReport,
  menuReport,
  employeeReport,
  getSalesBetween,
  getMostPopularMenuItem,
  getPeakSalesHour,
  pool
};
