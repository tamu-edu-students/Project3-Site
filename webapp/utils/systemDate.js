let systemDate = new Date();

module.exports = {
  // Get the system date with current time (uses artificial date but current time)
  getDate: () => {
    const now = new Date();
    const artificialDate = new Date(systemDate);
    // Set the time from current time, but keep the date from systemDate
    artificialDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return artificialDate;
  },

  // Increment system date by N days (default 1, preserves time)
  incrementDate: (days = 1) => {
    systemDate.setDate(systemDate.getDate() + days);
    return new Date(systemDate.getTime());
  },

  // Reset system date to current date and time
  resetDate: () => {
    systemDate = new Date();
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
