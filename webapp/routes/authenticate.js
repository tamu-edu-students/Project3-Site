const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/database');
const router = express.Router();

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {

    try {
        const email = profile.emails[0].value;

        // Check if the email exists in employees table
        const result = await db.pool.query(
            'SELECT * FROM employees WHERE email = $1',
            [email]
        );

        // default role
        let role = 'customer'; 

        if (result.rows.length > 0) {

            // Use db role of found employee. If not found, they are a customer
            role = (result.rows[0].role || 'customer').toLowerCase();
        } 

        const user = {
            id: profile.id,
            displayName: profile.displayName,
            email,
            role
        };

        done(null, user);
  } 
  catch (err) {
        console.error('Error during Google OAuth:', err);
        done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {

    if (req.user.role === 'manager') {
        res.redirect('/manager');
    } 

    else if (req.user.role === 'cashier') {
        res.redirect('/cashier');
    } 
    
    else {
        res.redirect('/customer');
    }

  }
);

module.exports = router;
