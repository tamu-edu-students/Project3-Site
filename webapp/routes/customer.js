const express = require('express');
const router = express.Router();
const db = require('../db/database');
let systemDate;
try { systemDate = require('../utils/systemDate'); } catch { /* optional */ }
require('dotenv').config();

// GET /customer -> render page (like manager does, pass user + WEATHER_KEY)
router.get('/', async (req, res, next) => {
  try {
    const menuItems = await db.getAll('menuitems');
    res.render('customer', {
      menuItems,
      user: req.user,
      WEATHER_KEY: process.env.WEATHER_KEY // not used on client, but matches manager signature
    });
  } catch (err) {
    next(err);
  }
});

// POST /customer/checkout -> create order + items + deduct inventory
router.post('/checkout', async (req, res) => {
  try {
    const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
    if (!cart.length) return res.status(400).json({ message: 'Cart is empty' });

    const normalized = cart.map(({ drink, toppings, qty, quantity, size, temperature, iceLevel, sugarLevel }) => ({
      drink,
      toppings: Array.isArray(toppings) ? toppings : [],
      quantity: Number(quantity ?? qty ?? 1),
      size,
      temperature,
      iceLevel,
      sugarLevel
    }));

    const orderDate = (systemDate && typeof systemDate.getDate === 'function')
      ? systemDate.getDate()
      : new Date();

    const result = await db.createOrderAndDeductInventory(normalized, {
      customerId: req.user?.customerId ?? 0,
      employeeId: 0, // kiosk/customer page -> no employee
      systemDate: orderDate
    });

    if (!result?.ok) {
      return res.status(400).json({ message: 'Insufficient inventory', shortages: result?.shortages });
    }
    return res.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error('Customer checkout error:', err);
    return res.status(500).json({ message: 'Server error during checkout.' });
  }
});

// Optional landing page
router.get('/landing', (req, res) => {
  res.render('landing');
});

module.exports = router;
