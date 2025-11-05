const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Render manager page
router.get('/', async (req, res) => {
    try {
        const menuItems = await db.getAll('menuitems');

        res.render('customer', { menuItems});
        console.log("customer.js loaded!");
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});


module.exports = router;
