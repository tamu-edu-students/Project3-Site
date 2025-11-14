const express = require('express');
const session = require('express-session');
const passport = require('passport');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(express.static('public'));
app.use(express.json());

app.set('view engine', 'ejs');

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});


// Unauthenticated route
app.use('/', require('./routes/unauthenticated'));

// Authentication route
app.use('/auth', require('./routes/authenticate'));

// All protected page routes
const { ensureRole } = require('./routes/protected');
app.use('/manager', ensureRole('manager'), require('./routes/manager'));
app.use('/cashier', ensureRole('cashier'), require('./routes/cashier'));
app.use('/customer', ensureRole('customer'), require('./routes/customer'));
 

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
