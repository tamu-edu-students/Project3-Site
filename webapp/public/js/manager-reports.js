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

// Modal close behavior

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('reportsScreen').style.display = 'none';
});

document.getElementById('closeInvBtn').addEventListener('click', () => {
    document.getElementById('inventoryScreen').style.display = 'none';
});

