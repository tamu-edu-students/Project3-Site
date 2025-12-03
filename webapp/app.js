const express = require('express');
const session = require('express-session');
const passport = require('passport');
const dotenv = require('dotenv');
const path = require('path');
const fetch = require('node-fetch');
const db = require('./db/database');

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

app.use('/translate', require('./routes/translate'));

// Unauthenticated route
app.use('/', require('./routes/unauthenticated'));

// Authentication route
app.use('/auth', require('./routes/authenticate'));


// All protected page routes
const { ensureRole } = require('./routes/protected');
app.use('/manager', ensureRole('manager'), require('./routes/manager'));
app.use('/cashier', ensureRole('cashier'), require('./routes/cashier'));
app.use('/customer', ensureRole('customer'), require('./routes/customer'));

// API

// Weather proxy route
app.get('/api/weather', async (req, res) => {
    const KEY = process.env.WEATHER_KEY;
    const CITY = "College Station";

    const url = `https://api.open-meteo.com/v1/forecast?latitude=30.62&longitude=-96.33&current_weather=true`;

    try {
        const r = await fetch(url);
        const data = await r.json();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Weather unavailable" });
    }
});

// Popular drinks route
app.get('/api/popular-drinks', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const popularDrinks = await db.getTopPopularDrinks(limit);
        res.json({ drinks: popularDrinks });
    } catch (err) {
        console.error('Error fetching popular drinks:', err);
        res.status(500).json({ error: "Failed to fetch popular drinks" });
    }
});
 

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
