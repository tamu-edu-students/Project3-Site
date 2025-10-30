const { Pool } = require('pg');
const dotenv = require('dotenv').config();

const pool = new Pool({
    user: process.env.PSQL_USER,
    host: process.env.PSQL_HOST,
    database: process.env.PSQL_DATABASE,
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
});

// Example: get all customers
async function getAllCustomers() {
    const result = await pool.query('SELECT * FROM customers');
    return result.rows;
}

async function getAllMenuItems() {
    const result = await pool.query('SELECT * FROM menuitems');
    return result.rows;
}

// You can export more functions here
module.exports = {
    getAllCustomers, getAllMenuItems
};
