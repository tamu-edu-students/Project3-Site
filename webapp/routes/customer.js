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

// POST /customer/checkout -> create order, orderitems, and deduct inventory
router.post('/checkout', async (req, res) => {
  try {
    const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
    if (!cart.length) return res.status(400).json({ message: 'Cart is empty' });

    // Normalize items expected by DB helper
    const normalized = cart.map(({ drink, toppings, qty, quantity, iceLevel, sugarLevel }) => ({
      drink,
      toppings: Array.isArray(toppings) ? toppings : [],
      quantity: Number(quantity ?? qty ?? 1),
      iceLevel: iceLevel || null,
      sugarLevel: sugarLevel || null,
    }));

    // If you have real customer/employee IDs, pass them here
    const options = {
      customerId: 0,
      employeeId: 0,
    };

    const result = await db.createOrderWithItems(normalized, options);

    if (result.shortages?.length) {
      return res.status(400).json({
        message: 'Not enough inventory to fulfill order.',
        shortages: result.shortages
      });
    }

    return res.json({ ok: true, orderId: result.orderId, total: result.totalAmount });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ message: 'Server error during checkout.' });
  }
});

module.exports = router;
