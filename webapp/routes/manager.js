const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Render manager page
router.get('/', async (req, res) => {
    try {
        const menuItems = await db.getAll('menuitems');
        const inventoryItems = await db.getAll('inventory');
        const recipes = await db.getAll('recipes');
        const employees = await db.getAll('employees');

        res.render('manager', { menuItems, inventoryItems, recipes, employees });
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

router.get('/inventory-usage', async (req, res) => {
    try {
        const query = `
            SELECT 
                i.ingredientname,
                COALESCE(SUM(r.quantity * oi."Quantity"), 0) AS total_used,
                i.unit
            FROM inventory i
            LEFT JOIN recipes r ON i.inventoryid = r.inventoryid
            LEFT JOIN orderitems oi ON r.itemid = oi."Item ID"
            GROUP BY i.ingredientname, i.unit
            ORDER BY total_used DESC
        `;
        
        const result = await db.pool.query(query); // use the pool directly
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching inventory usage:', err);
        res.status(500).json({ error: 'Failed to fetch inventory usage' });
    }
});
module.exports = router;
