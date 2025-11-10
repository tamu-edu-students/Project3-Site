const express = require('express');

const app = express();
const port = process.env.PORT || 3001;

// Basic logger (helps debug 404s)
app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });

// Static + JSON
app.use(express.static('public'));
app.use(express.json());

// EJS
app.set('view engine', 'ejs');

// Routers
const managerRouter = require('./routes/manager');
const customerRouter = require('./routes/customer');
const cashierRouter  = require('./routes/cashier');

app.use('/manager', managerRouter);
app.use('/customer', customerRouter);
app.use('/cashier',  cashierRouter);

app.get('/', (req, res) => {
  res.redirect('/cashier');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
