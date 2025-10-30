const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Render manager page
router.get('/', async (req, res) => {
    try {
        const menuItems = await db.getAll('menuitems');
        const inventoryItems = await db.getAll('inventory');
        const employees = await db.getAll('employees');

        res.render('manager', { menuItems, inventoryItems, employees });
        console.log("manager.js loaded!");
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

// Add new record to a section
router.post('/:section/add', async (req, res) => {
    const { section } = req.params;
    const data = req.body;

    try {
        const savedItem = await db.addItem(section, data);
        res.json(savedItem); // <-- return the full row with ID
    } catch (err) {
        console.error(`Error adding to ${section}:`, err);
        res.status(500).send('Failed to add item');
    }
});



// Delete record from a section
router.delete('/:section/delete/:id', async (req, res) => {
    const { section, id } = req.params;

    try {
        await db.deleteItem(section, id);
        res.sendStatus(200);
    } catch (err) {
        console.error(`Error deleting from ${section}:`, err);
        res.status(500).send('Failed to delete item');
    }
});

// Update record in a section
router.put('/:section/update/:id', async (req, res) => {
    const { section, id } = req.params;
    const updatedFields = req.body;
    delete updatedFields.id;

    try {
        await db.updateItem(section, id, updatedFields);
        res.sendStatus(200);
    } catch (err) {
        console.error(`Error updating ${section}:`, err);
        res.status(500).send('Failed to update item');
    }
});

module.exports = router;
