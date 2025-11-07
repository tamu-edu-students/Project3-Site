const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Render manager page
// Render manager page
router.get('/', async (req, res) => {
    try {
        // Fetch basic tables
        const menuItems = await db.getAll('menuitems');
        const inventoryItems = await db.getAll('inventory');
        const employees = await db.getAll('employees');

        // Fetch recipes joined with menuitems and inventory for friendly names
        const recipesQuery = `
            SELECT
                r.recipeid,
                r.itemid,
                m.itemname,
                r.inventoryid,
                i.ingredientname,
                r.quantity,
                r.unit
            FROM recipes r
            JOIN menuitems m ON r.itemid = m.itemid
            JOIN inventory i ON r.inventoryid = i.inventoryid
            ORDER BY r.itemid;
        `;

        const recipesResult = await db.pool.query(recipesQuery);
        const recipesRows = recipesResult.rows;

        // Group recipes by menu item
        const groupedRecipes = {};
        recipesRows.forEach(r => {
            if (!groupedRecipes[r.itemid]) {
                groupedRecipes[r.itemid] = {
                    itemname: r.itemname,
                    ingredients: []
                };
            }
            groupedRecipes[r.itemid].ingredients.push({
                recipeid: r.recipeid,
                ingredientname: r.ingredientname,
                quantity: r.quantity,
                unit: r.unit
            });
        });

        res.render('manager', {
            menuItems,
            inventoryItems,
            recipes: groupedRecipes,
            employees
        });

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

router.get('/api/reports', async (req, res) => {
  try {
    const reportData = await db.generalReport();
    // console.log('Fetched report data:', reportData); // Should now show real data
    res.json(reportData);
  } catch (err) {
    console.error('Error fetching report data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
