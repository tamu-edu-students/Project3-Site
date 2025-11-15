let systemDate = new Date();
systemDate.setHours(0, 0, 0, 0); // optional: zero out time

module.exports = {
  // Get the current system date
  getDate: () => new Date(systemDate.getTime()),

  // Increment system date by N days (default 1)
  incrementDate: (days = 1) => {
    systemDate.setDate(systemDate.getDate() + days);
    return new Date(systemDate.getTime());
  },

  // Reset system date to today
  resetDate: () => {
    const now = new Date();
    systemDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(systemDate.getTime());
  },

  // Optionally, set a custom date
  setDate: (date) => {
    const d = new Date(date);
    if (isNaN(d)) throw new Error(`Invalid date: ${date}`);
    systemDate = d;
    return new Date(systemDate.getTime());
  }
};
