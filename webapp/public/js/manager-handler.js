
const sectionMap = {
    'menu items': 'menuitems',
    'inventory items': 'inventory',
    'employees': 'employees',
    'recipes': 'recipes'
};
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.data-section').forEach(section => {
            const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
            const editBtn = section.querySelector('.update-btn');
            const dataGrid = section.querySelector('.data-grid');

            if (editBtn) {
                editBtn.addEventListener('click', (event) => {
                    event.stopPropagation();

                    // Prevent edit mode from activating if delete mode is active
                    if (dataGrid.classList.contains('show-deletes')) {
                        alert('Exit delete mode before editing.');
                        return;
                    }

                    enterEditMode(section, sectionName, editBtn, dataGrid);
                });
            }

    });

    function enterEditMode(section, sectionName, editBtn, dataGrid) {

        const controls = section.querySelector('.section-controls');
        
        // Replace Edit with Save + Cancel
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.classList.add('add-btn');

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.add('update-btn');

        //const controls = editBtn.parentElement;
        controls.replaceChild(saveBtn, editBtn);
        controls.appendChild(cancelBtn);

        // Make all cells editable
        dataGrid.querySelectorAll('.cell').forEach(cell => {
            cell.contentEditable = true;
            cell.classList.add('editable');
        });

        // Hide delete buttons
        dataGrid.querySelectorAll('button.hidden').forEach(btn => {
            btn.style.display = 'none';
        });

        dataGrid.classList.add('editing');

        // Cancel returns to normal mode without saving
        cancelBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            exitEditMode(section, dataGrid, saveBtn, cancelBtn, controls);
        });

        // Save edits to the database
        saveBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const rows = dataGrid.querySelectorAll('.data-row');

            for (const row of rows) {
                const rowData = {};
                    row.querySelectorAll('.cell').forEach(cell => {
                        let val = cell.textContent.trim();
                        if (['itemprice', 'ingredientquantity', 'quantity'].includes(cell.dataset.column)) {
                            val = Number(val) || 0;
                        }
                        rowData[cell.dataset.column] = val;
                    });

                const id = row.dataset.id;
                if (!id) continue; // skip new/unsaved rows

                try {
                    const res = await fetch(`/manager/${sectionName}/update/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(rowData)
                    });

                    if (!res.ok) {
                        const text = await res.text();
                        alert(`Failed to update row ${id}: ${text}`);
                    }
                } catch (err) {
                    console.error(`Error updating row ${id}:`, err);
                }
            }

            alert('All updates saved!');
            exitEditMode(section, dataGrid, saveBtn, cancelBtn, controls);
        });

    }


    function exitEditMode(section, dataGrid, saveBtn, cancelBtn, controls) {
        // Make cells non-editable
        dataGrid.querySelectorAll('.cell').forEach(cell => {
            cell.contentEditable = false;
            cell.classList.remove('editable');
        });

        dataGrid.classList.remove('editing');

        // Show delete buttons if delete mode is not active
        if (!dataGrid.classList.contains('show-deletes')) {
            dataGrid.querySelectorAll('button.hidden').forEach(btn => {
                btn.style.display = '';
            });
        }

        // Remove Cancel button
        cancelBtn.remove();

        // Replace Save button with Edit button
        const newEditBtn = document.createElement('button');
        newEditBtn.textContent = 'Edit';
        newEditBtn.classList.add('update-btn');
        controls.replaceChild(newEditBtn, saveBtn);

        // Reattach listener
        newEditBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
            const dataGrid = section.querySelector('.data-grid');

            if (dataGrid.classList.contains('show-deletes')) {
                alert('Exit delete mode before editing.');
                return;
            }
            enterEditMode(section, sectionName, newEditBtn, dataGrid); 
        });
    }

    document.querySelectorAll('.data-section').forEach(section => {
        const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
        const addBtn = section.querySelector('.add-btn');
        const dataGrid = section.querySelector('.data-grid');

        if (!addBtn || !dataGrid) return;

        // Special handling for recipes
        if (sectionName === 'recipes') {
            addBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                try {
                    // Fetch menu and inventory lists dynamically
                    const [menuRes, invRes] = await Promise.all([
                        fetch('/manager/menuitems'),
                        fetch('/manager/inventory')
                    ]);

                    if (!menuRes.ok || !invRes.ok) {
                        alert('Failed to load data for recipes');
                        return;
                    }

                    const menuItems = await menuRes.json();
                    const inventoryItems = await invRes.json();

                    addNewRecipeRow(dataGrid, menuItems, inventoryItems);
                } catch (err) {
                    console.error('Error fetching menu/inventory:', err);
                }
            });
        } else {
            // Default add handler for menuitems, inventory, employees
            addBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
                openAddModal(sectionName);
            });
        }
    });

    async function deleteItem(section, itemId) {
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            const res = await fetch(`/manager/${section}/delete/${itemId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
            });

            if (res.ok) {
            // Remove the item from the UI
            document.querySelector(`[data-id='${itemId}']`).remove();
            location.reload();
            } else {
            const text = await res.text();
            alert("Failed to delete item: " + text);
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting item");
        }
    }
    window.deleteItem = deleteItem;

    // Delete toggle
    document.querySelectorAll('.data-section').forEach(section => {
        const deleteToggleBtn = section.querySelector('.delete-btn'); // the "-" button
        const dataGrid = section.querySelector('.data-grid');

        if (!deleteToggleBtn || !dataGrid) return;

        deleteToggleBtn.addEventListener('click', () => {
            // Block while editing
            if (dataGrid.classList.contains('editing')) return;

            const isDeleting = dataGrid.classList.toggle('show-deletes');

            if (isDeleting) {
                // Switch "-" to "Cancel"
                deleteToggleBtn.textContent = "Cancel";
                deleteToggleBtn.classList.add('active');
                
                // Show all delete buttons (both regular rows and recipe items)
                dataGrid.querySelectorAll('button.hidden').forEach(btn => {
                    btn.style.display = 'inline-block';
                });
            } else {
                // Switch back to "-"
                deleteToggleBtn.textContent = "-";
                deleteToggleBtn.classList.remove('active');
                
                // Hide all delete buttons
                dataGrid.querySelectorAll('button.hidden').forEach(btn => {
                    btn.style.display = 'none';
                });
            }
        });
    });

    const inventoryChartCanvas = document.getElementById('inventoryChart');
    if (inventoryChartCanvas) {
        const ctx = inventoryChartCanvas.getContext('2d');
        let inventoryChart;

        async function fetchInventoryData() {
            try {
                const res = await fetch('/manager/inventory-usage');
                console.log('fetch status:', res.status);
                const data = await res.json();
                console.log('raw data from server:', data);  // <-- log here

                return data.map(item => ({
                    name: item.ingredientname,
                    quantity: parseFloat(item.total_used) || 0,
                    unit: item.unit || ''
                }));
            } catch (err) {
                console.error(err);
                return [];
            }
        }

        async function renderInventoryChart() {
            const inventory = await fetchInventoryData();
            const labels = inventory.map(i => i.name);
            const quantities = inventory.map(i => i.quantity);
            console.log("Inventory canvas check:", inventoryChartCanvas);

            if (inventoryChart) inventoryChart.destroy();

            inventoryChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Quantity',
                        data: quantities,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    return `${context.dataset.label}: ${quantities[idx]} ${inventory[idx].unit || ''}`;
                                }
                            }
                        },
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Quantity' } },
                        x: { title: { display: true, text: 'Ingredient' } }
                    }
                }
            });
        }

        renderInventoryChart();

        // Optional: add refresh button
        const refreshBtn = document.querySelector('#inventoryChartRefresh');
        if (refreshBtn) refreshBtn.addEventListener('click', renderInventoryChart);
    }
});