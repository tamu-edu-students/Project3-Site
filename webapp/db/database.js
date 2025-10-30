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

async function addItem(table, data) {
  // Map friendly keys to actual column names for each table
  const columnMap = {
    menuitems: {
      name: 'itemname',
      description: 'itemdescription',
      price: 'itemprice'
    },
    inventory: {
      name: 'ingredientname',
      ingredientquantity: 'ingredientquantity',
      unit: 'unit'
    },
    employees: {
      name: 'employeename'
      // add more if needed
    }
  };

  const tableMap = columnMap[table];

  // Keep only keys that exist for this table
  const filteredData = {};
  Object.keys(data).forEach(key => {
    if (tableMap[key]) filteredData[tableMap[key]] = key === 'price' || key === 'ingredientquantity' ? Number(data[key]) || 0 : data[key] || null;
  });

  const columns = Object.keys(filteredData).join(',');
  const values = Object.values(filteredData);
  const placeholders = values.map((_, idx) => `$${idx + 1}`).join(',');

  const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

  try {
    console.log('Executing query:', query, 'with values:', values);
    await pool.query(query, values);
  } catch (err) {
    console.error('Error inserting item:', err);
  }
}


// You can export more functions here
module.exports = {
    getAll, updateItem, addItem
};
