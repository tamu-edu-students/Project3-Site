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

module.exports = router;
