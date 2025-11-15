const express = require('express');
const router = express.Router();
const db = require('../db/database');
const systemDate = require('../utils/systemDate');

// get cashier page
router.get('/', async (req, res) => {
  try {
    const menuItems = await db.getAll('menuitems');
    res.render('cashier', { menuItems });
    console.log('cashier.js loaded!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

//create order, items, and deduct inventory
router.post('/checkout', async (req, res) => {
  try {
    const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
    if (!cart.length) return res.status(400).json({ message: 'Cart is empty' });

    const normalized = cart.map(({ drink, toppings, qty, quantity, iceLevel, sugarLevel }) => ({
      drink,
      toppings: Array.isArray(toppings) ? toppings : [],
      quantity: Number(quantity ?? qty ?? 1),
      iceLevel,
      sugarLevel
    }));

    // If you have logged-in cashier, pass real employeeId here
    const orderDate = systemDate.getDate();

    const result = await db.createOrderAndDeductInventory(normalized, {
      customerId: 0,
      employeeId: req.user.employeeId,
      systemDate: orderDate
    });

    if (!result.ok) {
      return res.status(400).json({ message: 'Insufficient inventory', shortages: result.shortages });
    }
    return res.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error('Cashier checkout error:', err);
    return res.status(500).json({ message: 'Server error during checkout.' });
  }
});

module.exports = router;
