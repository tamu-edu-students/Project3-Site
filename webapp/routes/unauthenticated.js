// routes/unauthenticated.js
const express = require('express');
const router = express.Router();

// Index page
router.get('/', (req, res) => {
  res.redirect('/login'); 
});

// Login page fallback
router.get('/login', (req, res) => {
  res.render('login');
});

// Unauthorized page
router.get('/unauthorized', (req, res) => {
  res.status(403).render('unauthorized');
});

module.exports = router;
