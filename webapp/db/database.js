const { Pool } = require('pg');
const dotenv = require('dotenv').config();

const pool = new Pool({
    user: process.env.PSQL_USER,
    host: process.env.PSQL_HOST,
    database: process.env.PSQL_DATABASE,
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
});

// Example: get all attributes of a table
async function getAll(table) {
    const result = await pool.query(`SELECT * FROM ${table}`);
    return result.rows;
}

async function updateItem(table, id, fields) {
    const setString = Object.keys(fields)
        .map((key, idx) => `${key} = $${idx + 1}`)
        .join(', ');
    const values = Object.values(fields);

    const idColumn = table === 'employees' ? 'employeeid' :
                     table === 'menuitems' ? 'itemid' : 'inventoryid';

    await pool.query(
        `UPDATE ${table} SET ${setString} WHERE ${idColumn} = $${values.length + 1}`,
        [...values, id]
    );
}

//new addItem
async function addItem(table, data) {
  // Map friendly keys to actual column names for each table
  const columnMap = {
    menuitems: ['itemname', 'itemdescription', 'itemprice'],
    inventory: ['ingredientname', 'ingredientquantity', 'unit'],
    employees: ['employeename']
  };

  const validColumns = columnMap[table];
  if (!validColumns) throw new Error(`Unknown table: ${table}`);

  // Keep only keys that exist for this table
  const filteredData = {};
  validColumns.forEach(col => {
    if (data[col] !== undefined) {
      filteredData[col] =
        ['itemprice', 'ingredientquantity'].includes(col)
          ? Number(data[col]) || 0
          : data[col] || null;
    }
  });

  const columns = Object.keys(filteredData);
  const values = Object.values(filteredData);

  if (columns.length === 0) {
    throw new Error('No valid data to insert');
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

  try {
    console.log('Executing query:', query, 'with values:', values);
    const result = await pool.query(query, values);
    return result.rows[0]; // return inserted row with id
  } catch (err) {
    console.error('Error inserting item:', err);
    throw err;
  }
}



async function deleteItem(table, id) {
  const idColumn =
    table === "employees"
      ? "employeeid"
      : table === "menuitems"
      ? "itemid"
      : "inventoryid";

  try {
    await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id]);
    console.log(`Deleted item with ID ${id} from ${table}`);
  } catch (err) {
    console.error(`Error deleting item from ${table}:`, err);
    throw err; // rethrow so the route can handle the error
  }
}

async function generalReport() {
  // 1️⃣ Total Sales
  const totalSalesResult = await pool.query('SELECT SUM("Total Amount") AS total_sales FROM orders');
  const total = totalSalesResult.rows.length > 0 && totalSalesResult.rows[0].total_sales
      ? parseFloat(totalSalesResult.rows[0].total_sales)
      : 0.0;
  const totalSales = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);

  // 2️⃣ Total Orders
  const totalOrdersResult = await pool.query('SELECT COUNT(*) AS total_orders FROM orders');
  const totalOrders = totalOrdersResult.rows.length > 0
      ? parseInt(totalOrdersResult.rows[0].total_orders, 10)
      : 0;

  // 3️⃣ Peak Sales Hour
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

  // 4️⃣ Most Popular Menu Item
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




// You can export more functions here
module.exports = {
    getAll, updateItem, addItem, deleteItem, pool, generalReport
};
