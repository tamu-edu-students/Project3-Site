const express = require('express');

// Create express app
const app = express();
const port = process.env.PORT || 3001;

// Serve static files from public
app.use(express.static('public'));

app.use(express.json())

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Mount manager route
const managerRouter = require('./routes/manager');
app.use('/manager', managerRouter);

// Customer route
const customerRoute = require('./routes/customer');
app.use('/customer', customerRoute);

// Cashier route
const cashierRoute = require('./routes/cashier');
app.use('/cashier', cashierRoute);

app.get('/', (req, res) => {
  res.redirect('/cashier');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});