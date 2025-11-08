document.getElementById('reports').addEventListener('click', async () => {
    console.log('Reports button clicked!');
    const modal = document.getElementById('reportsScreen');
    modal.style.display = 'block';

    try {
        const res = await fetch('/manager/api/reports');
        const data = await res.json();
        console.log('Fetched report data:', data);

        document.getElementById('totalSales').textContent = `Total Sales: ${data.totalSales}`;
        document.getElementById('totalOrders').textContent = `Total Orders: ${data.totalOrders}`;
        document.getElementById('peakHour').textContent = `Peak Sales Hour: ${data.peakHour}`;
        document.getElementById('popularDrink').textContent = `Most Popular Drink: ${data.popularDrink}`;
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
    const res = await fetch('/manager/api/invReports');
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
    const response = await fetch(`/manager/api/invReports?${params.toString()}`);
    const data = await response.json();
    console.log('Fetched filtered inventory report:', data);
    populateInventoryTable(data.items);
  } catch (err) {
    console.error('Error fetching filtered inventory report:', err);
  }
});

// 🧮 Helper function to populate inventory table
function populateInventoryTable(items) {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = ''; // clear previous rows

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No data available</td></tr>';
    return;
  }

  items.forEach(item => {
    const row = `
      <tr>
        <td>${item.ingredient}</td>
        <td>${item.quantity_in_stock}</td>
        <td>${item.total_used}</td>
        <td>${item.remaining}</td>
        <td>${item.unit}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', row);
  });
}

document.getElementById('menuReport').addEventListener('click', async () => {
  console.log('Menu Reports button clicked!');
  const modal = document.getElementById('menuScreen');
  modal.style.display = 'block';

  try {
    const res = await fetch('/manager/api/menuReport');
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

    data.forEach(item => {
      const highlightClass = item.times_ordered == maxOrders ? 'highlight-row' : '';

      const row = `
        <tr class="${highlightClass}">
          <td>${item.itemname}</td>
          <td style="text-align: center">${formatter.format(item.itemprice)}</td>
          <td style="text-align: center">${item.times_ordered}</td>
        </tr>
      `; 
      tbody.insertAdjacentHTML('beforeend', row);
    });
  } catch (err) {
    console.error('Error fetching menu report data:', err);
  } 
});

document.getElementById('employeeReport').addEventListener('click', async () => {
  console.log('Employee Reports button clicked!');
  const modal = document.getElementById('employeeScreen');
  modal.style.display = 'block';

  try {
    const res = await fetch('/manager/api/employeeReport');
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
    const response = await fetch(`/manager/api/salesReport?start=${start}&end=${end}`);
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

    document.querySelector('.table-container p:nth-child(1)').textContent = 
      `Most popular drink: ${data.mostPopularItem}`;
    document.querySelector('.table-container p:nth-child(2)').textContent = 
      `Most popular hour: ${data.peakHour}`;


  } catch (err) {
    console.error('Error fetching sales report data:', err);
  }
}



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