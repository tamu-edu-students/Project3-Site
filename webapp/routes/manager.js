const express = require('express');
const router = express.Router();
const db = require('../db/database');
const systemDate = require('../utils/systemDate');
require('dotenv').config();

// Ensure user has proper roles
const { ensureRole } = require('./protected');
router.use(ensureRole('manager'));

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
                    itemid: r.itemid,
                    itemname: r.itemname,
                    ingredients: []
                };
            }
            groupedRecipes[r.itemid].ingredients.push({
                recipeid: r.recipeid,
                inventoryid: r.inventoryid,
                ingredientname: r.ingredientname,
                quantity: r.quantity,
                unit: r.unit
            });
        });

        res.render('manager', {
            menuItems,
            inventoryItems,
            recipes: groupedRecipes,
            employees,
            user: req.user,
            WEATHER_KEY: process.env.WEATHER_KEY
        });

        console.log("manager.js loaded!");
    } catch (err) {
        console.error(err);
        res.status(500).send('Database error');
    }
});

router.get('/inventory', async (req, res) => {
    try {
        const inventory = await db.getAll('inventory');
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/menuitems', async (req, res) => {
    try {
        const items = await db.getAll('menuitems');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/employees', async (req, res) => {
    try {
        const employees = await db.getAll('employees');
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Route to get recipes as JSON
router.get('/recipes', async (req, res) => {
    try {
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
                    itemid: r.itemid,
                    itemname: r.itemname,
                    ingredients: []
                };
            }
            groupedRecipes[r.itemid].ingredients.push({
                recipeid: r.recipeid,
                inventoryid: r.inventoryid,
                ingredientname: r.ingredientname,
                quantity: r.quantity,
                unit: r.unit
            });
        });

        res.json(groupedRecipes); // <-- return JSON

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});




// Special add route for recipes
router.post('/recipes/add', async (req, res) => {
    try {
        const savedRecipe = await db.addRecipe(req.body);
        res.json(savedRecipe);
    } catch (err) {
        console.error('Error adding recipe:', err);
        res.status(500).send('Failed to add recipe');
    }
});

// Special update route for recipes
router.put('/recipes/update/:id', async (req, res) => {
    try {
        await db.updateRecipe(req.params.id, req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error('Error updating recipe:', err);
        res.status(500).send('Failed to update recipe');
    }
});

// Special delete route for recipes
router.delete('/recipes/delete/:id', async (req, res) => {
    try {
        await db.deleteRecipe(req.params.id);
        res.sendStatus(200);
    } catch (err) {
        console.error('Error deleting recipe:', err);
        res.status(500).send('Failed to delete recipe');
    }
});

// Special route to delete all ingredients for a menu item (entire recipe)
router.delete('/recipes/deleteall/:itemid', async (req, res) => {
    try {
        await db.deleteRecipesByMenuItem(req.params.itemid);
        res.sendStatus(200);
    } catch (err) {
        console.error('Error deleting entire recipe:', err);
        res.status(500).send('Failed to delete recipe');
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

// Add endpoint to fetch menu and inventory items for the add form
router.get('/menuitems', async (req, res) => {
    try {
        const items = await db.getAll('menuitems');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
});

router.get('/inventory', async (req, res) => {
    try {
        const items = await db.getAll('inventory');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

router.get('/reports', async (req, res) => {
  try {
    const reportData = await db.generalReport();
    console.log('Fetched report data:', reportData); // Should now show real data
    res.json(reportData);
  } catch (err) {
    console.error('Error fetching report data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/invReports', async (req, res) => {
  try {
    // Extract query parameters (start and end times)
    const { start, end } = req.query;

    // Pass them to your inventoryReport function
    const invReportData = await db.inventoryReport(start, end);

    console.log('Fetched inventory report data:', invReportData);
    res.json(invReportData);
  } catch (err) {
    console.error('Error fetching inventory report data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/menuReport', async (req, res) => {
    try {
        const menuReportData = await db.menuReport();
        console.log('Fetched menu report data:', menuReportData);
        res.json(menuReportData);
    } catch (err) {
        console.error('Error fetching menu report data:', err);
        res.status(500).json({ error: 'Server error' });
    }   
});

router.get('/employeeReport', async (req, res) => {
    try {
        const employeeReportData = await db.employeeReport();  
        console.log('Fetched employee report data:', employeeReportData);
        res.json(employeeReportData);
    } catch (err) {
        console.error('Error fetching employee report data:', err);
        res.status(500).json({ error: 'Server error' });
    }   
});

router.get('/salesReport', async (req, res) => {
    try {
        const { start, end } = req.query;

        const [salesData, popularItem, peakHour] = await Promise.all([
            db.getSalesBetween(start, end),
            db.getMostPopularMenuItem(start, end),
            db.getPeakSalesHour(start, end)
        ]); 

        console.log('Fetched sales report data:', popularItem);
        res.json({
            sales: salesData,
            mostPopularItem: popularItem,
            peakHour: peakHour
        });
        console.log(res.json)


    } catch (err) {
        console.error('Error fetching sales report data:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/salesByItem', async (req, res) => {
    const { start, end } = req.query;

    try {
        const data = await db.getSalesByItem(start, end);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate sales-by-item report.'});
    }
});

router.get('/sales-per-hour', async (req, res) => {
    try {
        const data = await db.loadSalesPerHour();
        console.log(data)
        res.json(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Failed to load sales per hour"});
    }
})

router.get('/orders-per-hour', async (req, res) => {
    try {
        const data = await db.loadOrdersPerHour();
        console.log(data);
        res.json(Array.isArray(data) ? data: []);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Failed to load orders per hour"});
    }
})

router.get('/customers-per-hour', async (req, res) => {
    try {
        const data = await db.loadCustomersPerHour();
        console.log(data);
        res.json(Array.isArray(data) ? data: []);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: "Failed to load customers per hour"});
    }
})

router.get('/items-per-hour', async (req, res) => {
    try {
        const data = await db.loadItemsPerHour();
        console.log(data);
        res.json(Array.isArray(data) ? data: []);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: "Failed to load items per hour"});
    }
})

router.get('/avg-orders-per-hour', async (req, res) => {
    try {
        const data = await db.loadAvgOrderValuePerHour();
        console.log(data);
        res.json(Array.isArray(data) ? data: []);
    } catch (err) {
        console.log(err);
        res.status(500).json({error: "Failed to load avg orders per hour"});
    }
})


router.get('/zreport', async (req, res) => {
  try {
    const date = req.query.date; // expected format: YYYY-MM-DD
    const totalSales = await db.getTotalSalesForDate(date);
    const totalOrders = await db.getTotalOrdersForDate(date);
    const mostPopularItem = await db.getMostPopularMenuItemForDate(date);
    const bestEmployee = await db.getTopEmployeeForDate(date);
    const bestHour = await db.getPeakSalesHourForDate(date);

    // You can add more fields here if needed (total orders, items sold, etc.)
    res.json({
      date,
      totalSales,
      totalOrders,
      mostPopularItem,
      bestEmployee,
      bestHour
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch Z-report" });
  }
});

router.get('/currentdate', (req, res) => {
    const date = systemDate.getDate();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    res.json({ date: `${yyyy}-${mm}-${dd}` });
});

router.post('/incrementdate', (req, res) => {
    const date = systemDate.incrementDate(1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    res.json({ date: `${yyyy}-${mm}-${dd}` });
});

router.post('/resetdate', (req, res) => {
    const date = systemDate.resetDate();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    res.json({ date: `${yyyy}-${mm}-${dd}` });
});

router.post('/setdate', (req, res) => {
    try {
        const { date } = req.body;
        const parsedDate = systemDate.setDate(date);
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        res.json({ date: `${yyyy}-${mm}-${dd}` });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
