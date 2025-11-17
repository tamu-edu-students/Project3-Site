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
        const employee_result = await db.pool.query(
            'SELECT * FROM employees WHERE email = $1',
            [email]
        );

        // Check if the email exists in customers table
        const customer_result = await db.pool.query(
            'SELECT * FROM customers WHERE email = $1',
            [email]
        );

        // default values
        let role = 'customer'; 
        let employeeId = 0;
        let customerId = 0;

        // If found in employees table, set role and employeeId
        if (employee_result.rows.length > 0) {

            // Use db role of found employee. If not found, they are a customer and have no employeeId (0)
            role = (employee_result.rows[0].role || 'customer').toLowerCase();
            employeeId = employee_result.rows[0].employeeid;
        } 

        // If found in customers table, set customerId
        if(role === 'customer') {

            // Get their customerId if they already exist in db
            if(customer_result.rows.length > 0) {
                customerId = customer_result.rows[0].customer_id;
            }

            // If they don't exist, create a new customer record
            else {
                const add_customer_result = await db.pool.query(
                    'INSERT INTO customers (customer_name, email) VALUES ($1, $2) RETURNING customer_id',
                    [profile.displayName,email]
                );
                customerId = add_customer_result.rows[0].customer_id;
            }

        }

        const user = {
            id: profile.id,
            displayName: profile.displayName,
            email,
            role,
            employeeId,
            customerId
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
    passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
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
