// Helper to get localized labels for reports based on current page language
function getReportLabel(key) {
  const lang = window.pageLang || 'en';

  const labels = {
    en: {
      totalSales: 'Total Sales',
      totalOrders: 'Total Orders',
      peakHour: 'Peak Sales Hour',
      popularDrink: 'Most Popular Drink',
      mostPopularDrink: 'Most popular drink',
      mostPopularHour: 'Most popular hour',
      bestSellingItem: 'Best-Selling Item',
      topEmployee: 'Top Employee',
      noDataAvailable: 'No data available',
      noSalesFound: 'No sales found for this date range.',
    },
    es: {
      totalSales: 'Ventas totales',
      totalOrders: 'Pedidos totales',
      peakHour: 'Hora pico de ventas',
      popularDrink: 'Bebida más popular',
      mostPopularDrink: 'Bebida más popular',
      mostPopularHour: 'Hora más popular',
      bestSellingItem: 'Artículo más vendido',
      topEmployee: 'Empleado destacado',
      noDataAvailable: 'No hay datos disponibles',
      noSalesFound: 'No se encontraron ventas para este rango de fechas.',
    },
  };

  const set = labels[lang] || labels.en;
  return set[key] || labels.en[key] || key;
}

// Helper to translate arbitrary text segments if the current page language
// is not English. Returns the input array unchanged when in English.
async function translateIfNeeded(texts) {
  const lang = window.pageLang || 'en';

  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  if (lang === 'en') {
    return texts;
  }

  try {
    const res = await fetch('/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: lang,
        texts,
      }),
    });

    const data = await res.json();
    if (!data || !Array.isArray(data.translations)) {
      console.error('Translation response malformed:', data);
      return texts;
    }

    return data.translations;
  } catch (e) {
    console.error('Translation error in reports:', e);
    return texts;
  }
}

document.getElementById('reports').addEventListener('click', async () => {
    console.log('Reports button clicked!');
    const modal = document.getElementById('reportsScreen');
    modal.style.display = 'block';

    try {
        const res = await fetch('/manager/reports');
        const data = await res.json();
        console.log('Fetched report data:', data);

        // Translate the popular drink name if needed
        const [translatedPopularDrink] = await translateIfNeeded([data.popularDrink]);

        document.getElementById('totalSales').textContent =
          `${getReportLabel('totalSales')}: ${data.totalSales}`;
        document.getElementById('totalOrders').textContent =
          `${getReportLabel('totalOrders')}: ${data.totalOrders}`;
        document.getElementById('peakHour').textContent =
          `${getReportLabel('peakHour')}: ${data.peakHour}`;
        document.getElementById('popularDrink').textContent =
          `${getReportLabel('popularDrink')}: ${translatedPopularDrink || data.popularDrink}`;
        
        // Note: No need to call translateNewContent here because getReportLabel()
        // already returns the correct language based on window.pageLang
    } catch (err) {
        console.error('Error fetching report data:', err);
    }
});

document.getElementById('inventoryReport').addEventListener('click', async () => {
  console.log('Inventory Reports button clicked!');
  const modal = document.getElementById('inventoryScreen');
  modal.style.display = 'block';

  try {
    // Fetch current inventory report (no date range)
    const res = await fetch('/manager/invReports');
    const data = await res.json();
    console.log('Fetched inventory report data:', data);

    populateInventoryTable(data.items);
  } catch (err) {
    console.error('Error fetching inventory report data:', err);
  }
});

// 📅 Generate Inventory Report (with date filter)
document.getElementById('generateReportBtn').addEventListener('click', async () => {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;

  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);

  try {
    const response = await fetch(`/manager/invReports?${params.toString()}`);
    const data = await response.json();
    console.log('Fetched filtered inventory report:', data);
    populateInventoryTable(data.items);
  } catch (err) {
    console.error('Error fetching filtered inventory report:', err);
  }
});

// 🧮 Helper function to populate inventory table
async function populateInventoryTable(items) {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = ''; // clear previous rows

  if (!items || items.length === 0) {
    const noDataText = getReportLabel('noDataAvailable');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${noDataText}</td></tr>`;
    return;
  }

  // Translate ingredient names in one batch if needed
  const ingredientNames = items.map(item => item.ingredient);
  const translatedIngredients = await translateIfNeeded(ingredientNames);

    items.forEach((item, index) => {
      const displayIngredient = translatedIngredients[index] || item.ingredient;

      const row = `
        <tr>
          <td>${displayIngredient}</td>
          <td>${item.quantity_in_stock}</td>
          <td>${item.total_used}</td>
          <td>${item.remaining}</td>
          <td>${item.unit}</td>
        </tr>
      `;
      tbody.insertAdjacentHTML('beforeend', row);
    });
    
    // Translate the table if page is in Spanish
    if (window.translateNewContent && (window.pageLang === 'es')) {
      setTimeout(() => {
        window.translateNewContent(tbody);
      }, 50);
    }
}

document.getElementById('menuReport').addEventListener('click', async () => {
  console.log('Menu Reports button clicked!');
  const modal = document.getElementById('menuScreen');
  modal.style.display = 'block';

  try {
    const res = await fetch('/manager/menuReport');
    const data = await res.json();
    console.log('Fetched menu report data:', data);
    const tbody = document.getElementById('menuTableBody');
    tbody.innerHTML = ''; // clear previous rows

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    const timesOrderedNumbers = data.map(item => Number(item.times_ordered));
    const maxOrders = Math.max(...timesOrderedNumbers);
    console.log('Max orders:', maxOrders);

    // Translate all item names in one batch if needed
    const itemNames = data.map(item => item.itemname);
    const translatedNames = await translateIfNeeded(itemNames);

    data.forEach((item, index) => {
      const highlightClass = item.times_ordered == maxOrders ? 'highlight-row' : '';
      const displayName = translatedNames[index] || item.itemname;

      const row = `
        <tr class="${highlightClass}">
          <td>${displayName}</td>
          <td style="text-align: center">${formatter.format(item.itemprice)}</td>
          <td style="text-align: center">${item.times_ordered}</td>
        </tr>
      `; 
      tbody.insertAdjacentHTML('beforeend', row);
    });
    
    // Translate the table if page is in Spanish
    if (window.translateNewContent && (window.pageLang === 'es')) {
      setTimeout(() => {
        window.translateNewContent(tbody);
      }, 50);
    }
  } catch (err) {
    console.error('Error fetching menu report data:', err);
  } 
});

document.getElementById('employeeReport').addEventListener('click', async () => {
  console.log('Employee Reports button clicked!');
  const modal = document.getElementById('employeeScreen');
  modal.style.display = 'block';

  try {
    const res = await fetch('/manager/employeeReport');
    const data = await res.json();
    console.log('Fetched employee report data:', data);
    const tbody = document.getElementById('employeeTableBody');
    tbody.innerHTML = ''; // clear previous rows

    const ordersNumbers = data.map(emp => Number(emp.orders_handled));
    const maxOrders = Math.max(...ordersNumbers);
    console.log('Max orders handled:', maxOrders);

    data.forEach(emp => {
      const orders = Number(emp.orders_handled);
      const highlightClass = orders == maxOrders ? 'highlight-row' : '';

      const row = `
        <tr class="${highlightClass}">
          <td>${emp.employeename}</td>
          <td style="text-align: center">${orders}</td>
        </tr>
      `; 
      tbody.insertAdjacentHTML('beforeend', row);
    });
    
    // Translate the table if page is in Spanish
    if (window.translateNewContent && (window.pageLang === 'es')) {
      setTimeout(() => {
        window.translateNewContent(tbody);
      }, 50);
    }
  } catch (err) {
    console.error('Error fetching menu report data:', err);
  } 
});

document.getElementById('salesReport').addEventListener('click', async () => {
  console.log('Sales Reports button clicked!');
  const modal = document.getElementById('salesScreen');
  modal.style.display = 'block';
});

document.getElementById('generateSalesReportBtn').addEventListener('click', async () => {
  const start = document.getElementById('salesStartDate').value;
  const end = document.getElementById('salesEndDate').value;

  console.log(start);
  console.log(end);

  await salesReport(start, end);

});

async function salesReport(start, end ) {
  try {
    const response = await fetch(`/manager/salesReport?start=${start}&end=${end}`);
    const data = await response.json();
    console.log('Fetched sales report data:', data);

    const tbody = document.getElementById('salesReportTableBody');
    tbody.innerHTML = ''; 

    data.sales.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.order_id}</td>
        <td>${new Date(row.order_date).toLocaleDateString()}</td>
        <td>${row.customer || "Guest"}</td>
        <td>$${Number(row.total).toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Translate the most popular drink name if needed
    const [translatedMostPopular] = await translateIfNeeded([data.mostPopularItem]);

    document.querySelector('.table-container p:nth-child(1)').textContent = 
      `${getReportLabel('mostPopularDrink')}: ${translatedMostPopular || data.mostPopularItem}`;
    document.querySelector('.table-container p:nth-child(2)').textContent = 
      `${getReportLabel('mostPopularHour')}: ${data.peakHour}`;
    
    // Translate the table if page is in Spanish
    if (window.translateNewContent && (window.pageLang === 'es')) {
      setTimeout(() => {
        const salesScreen = document.getElementById('salesScreen');
        if (salesScreen) {
          window.translateNewContent(salesScreen);
        }
      }, 50);
    }

  } catch (err) {
    console.error('Error fetching sales report data:', err);
  }
}

document.getElementById('itemizedSalesReport').addEventListener('click', async () => {
  console.log('Itemized Sales Reports button clicked!');
  const modal = document.getElementById('itemizedSalesScreen');
  modal.style.display = 'block';
});

document.getElementById("generateItemizedReportBtn").addEventListener("click", async () => {
    const start = document.getElementById("startDateItemSales").value;
    const end = document.getElementById("endDateItemSales").value;

    if (!start || !end) {
        alert("Please select both start and end dates.");
        return;
    }

    try {
        // 🔹 Call your API
        const res = await fetch(`/manager/salesByItem?start=${start}&end=${end}`);
        const data = await res.json();

        console.log("Itemized Sales Report:", data);

        // 🔹 Get table body
        const tableBody = document.getElementById("itemizedSalesTableBody");

        // Clear old rows
        tableBody.innerHTML = "";

        const maxQty = Math.max(...data.map(item => Number(item.quantity)));
        const maxRev = Math.max(...data.map(item => Number(item.sales)));

        // Translate all item names in one batch if needed
        const itemNames = data.map(item => item.itemName);
        const translatedNames = await translateIfNeeded(itemNames);

        // 🔹 Insert new rows
        data.forEach((item, index) => {
            const row = document.createElement("tr");
            const qty = Number(item.quantity);
            const rev = Number(item.sales);

            if (qty === maxQty) {
              row.classList.add("highlight-row")
            }
            if (rev === maxRev) {
              row.style.backgroundColor = "yellow";
              row.style.fontWeight = "bold";
            }
            if (rev === maxRev && qty === maxQty) {
              row.style.backgroundColor = "orange";
              row.style.fontWeight = "bold";
            }

            const displayName = translatedNames[index] || item.itemName;

            row.innerHTML = `
                <td>${displayName}</td>
                <td>${item.quantity}</td>
                <td>$${Number(item.sales).toFixed(2)}</td>
            `;

            tableBody.appendChild(row);
        });

        if (data.length === 0) {
            const noSalesText = getReportLabel('noSalesFound');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; opacity: 0.6;">
                        ${noSalesText}
                    </td>
                </tr>
            `;
        }
        
        // Translate the table if page is in Spanish
        if (window.translateNewContent && (window.pageLang === 'es')) {
          setTimeout(() => {
            window.translateNewContent(tableBody);
          }, 50);
        }

    } catch (err) {
        console.error("Error loading sales report:", err);
        alert("Failed to fetch report. Check console for errors.");
    }
});

document.getElementById('x-reports').addEventListener('click', () => {
  console.log('X Reports button clicked!');
  document.getElementById('xReportScreen').style.display = 'block';
  getSalesPerHour();
  getOrdersPerHour();
  getCustomersPerHour();
  getItemsPerHour();
  getAvgOrderValuePerHour();
})

async function getSalesPerHour() {
    try {
        const res = await fetch('/manager/sales-per-hour');
        const data = await res.json();
        console.log(data)
        if (!Array.isArray(data)) {
            console.error('Sales data is not an array:', data);
            return;
        }
        fillSalesTable(data);
    } catch (err) {
        console.error('Failed to fetch sales per hour:', err);
    }
}


function fillSalesTable(rows) {
  const tbl = document.getElementById("tblSales");

  // clear previous rows (keep header)
  tbl.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const tdHour = document.createElement("td");
    const tdSales = document.createElement("td");

    // Format hour
    const date = new Date(r.hour);
    const hour = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    tdHour.textContent = hour;
    tdSales.textContent = `$${Number(r.sales).toFixed(2)}`;

    tr.appendChild(tdHour);
    tr.appendChild(tdSales);

    tbl.appendChild(tr);
  });
}

async function getOrdersPerHour() {
  try {
    const res = await fetch('/manager/orders-per-hour');
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('Orders data is not an array: ', data);
      return;
    }
    fillOrdersTable(data);
  } catch (err) {
    console.error('Failed to fetch orders per hour: ', err);
  }
}

function fillOrdersTable(rows) {
  const tbl = document.getElementById("tblOrders");

  tbl.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const tdHour = document.createElement("td");
    const tdOrders = document.createElement("td");

    const date = new Date(r.hour);
    const hour = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    tdHour.textContent = hour;
    tdOrders.textContent = r.orders;

    tr.appendChild(tdHour);
    tr.appendChild(tdOrders);
    
    tbl.appendChild(tr);
  })
}

async function getCustomersPerHour() {
  try {
    const res = await fetch('/manager/customers-per-hour');
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('Orders data is not an array: ', data);
      return;
    }
    fillCustomersTable(data);
  } catch (err) {
    console.error('Failed to fetch orders per hour: ', err);
  }
}

function fillCustomersTable(rows) {
  const tbl = document.getElementById('tblCustomers');
  tbl.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const tdHour = document.createElement("td");
    const tdCustomers = document.createElement("td");

    const date = new Date(r.hour);
    const hour = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    tdHour.textContent = hour;
    tdCustomers.textContent = r.customers;

    tr.appendChild(tdHour);
    tr.appendChild(tdCustomers);

    tbl.appendChild(tr);

  })
}

async function getItemsPerHour() {
  try {
    const res = await fetch('/manager/items-per-hour');
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('Items data is not an array: ', data);
      return;
    }
    fillItemsTable(data);
  } catch (err) {
    console.error('Failed to fetch items per hour: ', err);
  }
}

function fillItemsTable(rows) {
  const tbl = document.getElementById('tblItems');
  tbl.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const tdHour = document.createElement("td");
    const tdItems = document.createElement("td");

    const date = new Date(r.hour);
    const hour = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    tdHour.textContent = hour;
    tdItems.textContent = r.items;

    tr.appendChild(tdHour);
    tr.appendChild(tdItems);

    tbl.appendChild(tr);

  })
}

async function getAvgOrderValuePerHour() {
  try {
    const res = await fetch('/manager/avg-orders-per-hour');
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('Avg Orders data is not an array: ', data);
      return;
    }
    fillAvgOrdersTable(data);
  } catch (err) {
    console.error('Failed to fetch avg orders per hour: ', err);
  }
}

function fillAvgOrdersTable(rows) {
  const tbl = document.getElementById('tblAvg');
  tbl.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const tdHour = document.createElement("td");
    const tdAvg = document.createElement("td");

    const date = new Date(r.hour);
    const hour = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    tdHour.textContent = hour;
    tdAvg.textContent = `$${Number(r.avg_amount).toFixed(2)}`;;

    tr.appendChild(tdHour);
    tr.appendChild(tdAvg);

    tbl.appendChild(tr);

  })
}

document.getElementById('z-report').addEventListener('click', async () => {
    document.getElementById('z-reportScreen').style.display = 'block';

    try {
        // Just load the Z-Report for the current system date
        const res = await fetch('/manager/currentdate');
        const data = await res.json();
        const today = new Date(data.date + "T00:00");

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById("todayDate").textContent = today.toLocaleDateString('en-US', options);

        loadZReport(today.toISOString().split("T")[0]);

    } catch (err) {
        console.error("Error loading Z-Report:", err);
    }
});


async function loadZReport(date) {
    const response = await fetch(`/manager/zreport?date=${date}`);
    const data = await response.json();
    console.log("Received:", data);

    const table = document.getElementById("zReportTable");
    table.innerHTML = ""; // Clear old contents

    // Translate best-selling drink name if needed
    const [translatedBestItem] = await translateIfNeeded([data.mostPopularItem.itemname]);

    const rows = [
        { desc: getReportLabel("totalSales"), value: `$${Number(data.totalSales).toFixed(2)}` },
        { desc: getReportLabel("totalOrders"), value: `${data.totalOrders}`},
        { desc: getReportLabel("bestSellingItem"), value: `${translatedBestItem || data.mostPopularItem.itemname}`},
        { desc: getReportLabel("topEmployee"), value: `${data.bestEmployee.employeename}`},
        { desc: getReportLabel("peakHour"), value: `${data.bestHour}`}
    ];

    rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.desc}</td>
            <td>${row.value}</td>
        `;
        table.appendChild(tr);
    });
    
    // Translate the table if page is in Spanish (for any dynamically added content)
    if (window.translateNewContent && (window.pageLang === 'es')) {
      setTimeout(() => {
        window.translateNewContent(table);
      }, 50);
    }
}

const today = new Date().toISOString().split("T")[0];
document.getElementById("todayDate").textContent = today;

// Modal close behavior

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('reportsScreen').style.display = 'none';
});

document.getElementById('closeInvBtn').addEventListener('click', () => {
    document.getElementById('inventoryScreen').style.display = 'none';
});

document.getElementById('closeMenuBtn').addEventListener('click', () => {
    document.getElementById('menuScreen').style.display = 'none';
});

document.getElementById('closeEmployeeBtn').addEventListener('click', () => { 
    document.getElementById('employeeScreen').style.display = 'none';
});

document.getElementById('closeSalesBtn').addEventListener('click', () => {
    document.getElementById('salesScreen').style.display = 'none';
});

document.getElementById('closeItemizedSalesBtn').addEventListener('click', () => {
  document.getElementById('itemizedSalesScreen').style.display = 'none';
});

document.getElementById('closeXReportBtn').addEventListener('click', () => {
  document.getElementById('xReportScreen').style.display = 'none';
});

document.getElementById('zReportCloseBtn').addEventListener('click', async () => {
    document.getElementById('z-reportScreen').style.display = 'none';

    const res = await fetch('/manager/incrementdate', { method: 'POST' });
    const data = await res.json();

    const [year, month, day] = data.date.split('-');
    const newDate = new Date(data.date + "T00:00");

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById("todayDate").textContent = newDate.toLocaleDateString('en-US', options);
});
