// routes/unauthenticated.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Index page
router.get('/', (req, res) => {
  res.redirect('/login'); 
});

// Login page fallback
router.get('/login', (req, res) => {
  res.render('login');
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) {
      return next(err);
    }

    // Destroy session to fully log out
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });
});


// Unauthorized page
router.get('/unauthorized', (req, res) => {
  res.status(403).render('unauthorized');
});

// Menu board page (read-only, no authentication required)
router.get('/menuboard', async (req, res, next) => {
  try {
    const menuItems = await db.getAll('menuitems');
    res.render('menuboard', { menuItems });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
