const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /customer -> page
router.get('/', async (req, res, next) => {
  try {
    const menuItems = await db.getAll('menuitems');
    res.render('customer', { menuItems });
  } catch (err) {
    next(err);
  }
});

// POST /customer/checkout -> create order + items + deduct inventory
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

    const result = await db.createOrderAndDeductInventory(normalized, {
      customerId: 0, // adjust if you track real customers
      employeeId: 0, // kiosk/customer page -> no employee
    });

    if (!result.ok) {
      return res.status(400).json({ message: 'Insufficient inventory', shortages: result.shortages });
    }
    return res.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error('Customer checkout error:', err);
    return res.status(500).json({ message: 'Server error during checkout.' });
  }
});

module.exports = router;
