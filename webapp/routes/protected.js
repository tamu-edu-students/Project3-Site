// protected.js
function ensureRole(minRole) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    };

    const roleHierarchy = ['customer', 'cashier', 'manager'];
    const userRole = req.user.role;
    console.log("User's role is " + userRole);

    if (roleHierarchy.indexOf(userRole) >= roleHierarchy.indexOf(minRole)) return next();

    res.redirect('/unauthorized');
  };
}

module.exports = { ensureRole };
