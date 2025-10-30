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



// You can export more functions here
module.exports = {
    getAll, updateItem
};
