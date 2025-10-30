const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Route for /manager
router.get('/', async (req, res) => {
    try {
        const customers = await db.getAllCustomers();
        res.render('manager', { customers });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

router.get('/', async (req, res) => {
    try {
        const menuItems = await db.getAllMenuItems();
        res.render('manager', { menuItems });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

module.exports = router;
