
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
                addNewRow(section, sectionName, dataGrid);
            });
        }
    });



    // Add new row directly in the grid
    const placeholderMap = {
        menuitems: {
            itemname: 'Item Name: (Ex: Burger)',
            itemprice: 'Item Price: (Ex: 9.99)',
            itemdescription: 'Description: (Ex: Juicy double patty)'
        },
        inventory: {
            ingredientname: 'Ingredient: (Ex: Lettuce)',
            ingredientquantity: 'Quantity: (Ex: 10)',
            unit: 'Unit: (Ex: lbs)'
        },
        employees: {
            employeename: 'Employee Name: (Ex: John Doe)'
        },
        recipes: { 
            itemid: 'Menu Item ID', 
            inventoryid: 'Inventory ID', 
            quantity: 'Quantity', 
            unit: 'Unit (Ex: lbs)' }
    };

    function addNewRow(section, sectionName, dataGrid) {
        const newRow = document.createElement('div');
        newRow.classList.add('data-row');
        newRow.id = 'hoverTag'; // <- important for hover behavior
        newRow.dataset.id = ''; // empty because it’s not in DB yet


        // Determine columns for this section
        const columns =
            sectionName === 'menuitems' ? ['itemname', 'itemprice'] :
            sectionName === 'inventory' ? ['ingredientname', 'ingredientquantity', 'unit'] :
            sectionName === 'recipes' ? ['itemid', 'inventoryid', 'quantity', 'unit'] :
            ['employeename'];

        // Create editable cells for each column
        // Create editable cells for each column
        columns.forEach(col => {
            const cell = document.createElement('div');
            cell.classList.add('cell', 'editable');
            cell.contentEditable = true;
            cell.dataset.column = col;

            const placeholderText = placeholderMap[sectionName]?.[col] || '';
            cell.textContent = placeholderText;
            if (placeholderText) cell.classList.add('placeholder');

            // Clear placeholder on focus
            cell.addEventListener('focus', () => {
                if (cell.classList.contains('placeholder')) {
                    cell.textContent = '';
                    cell.classList.remove('placeholder');
                }
            });

            // Restore placeholder if left empty
            cell.addEventListener('blur', () => {
                if (cell.textContent.trim() === '') {
                    if (col === 'itemname') {
                        cell.textContent = 'Enter item name...';
                    } else if (col === 'itemprice') {
                        cell.textContent = '0.00';
                    }
                    cell.classList.add('placeholder');
                }
            });

            newRow.appendChild(cell);
        });


        // --- Add description input for menuitems ---
        let descInput = null;
        if (sectionName === 'menuitems') {
            descInput = document.createElement('input');
            descInput.type = 'text';
            descInput.placeholder = 'Description';
            descInput.classList.add('desc-input');
            newRow.appendChild(descInput);
        }

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.classList.add('add-btn');

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.add('update-btn');

        cancelBtn.addEventListener('click', () => {
            newRow.remove();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'DELETE';
        deleteBtn.classList.add('hidden');
        deleteBtn.addEventListener('click', async(event) => {
            event.stopPropagation();
            if(!newRow.dataset.id) return newRow.remove();
            await deleteItem(sectionName, newRow.dataset.id);
        });

        saveBtn.addEventListener('click', async () => {
            const newData = {};
                newRow.querySelectorAll('.cell').forEach(cell => {
                let val = cell.textContent.trim();
                // Convert numeric fields
                if (['itemprice', 'ingredientquantity', 'quantity'].includes(cell.dataset.column)) {
                    val = val === '' ? 0 : Number(val);
                }
                newData[cell.dataset.column] = val;
            });

            // Include description for menuitems
            if (sectionName === 'menuitems' && descInput) {
                newData['itemdescription'] = descInput.value.trim();
            }

            try {
                const res = await fetch(`/manager/${sectionName}/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newData)
                });

                if (res.ok) {
                    alert('Item added!');
                    const result = await res.json();
                    const idKey =
                        sectionName === 'menuitems' ? 'itemid' :
                        sectionName === 'inventory' ? 'inventoryid' :
                        sectionName === 'recipes' ? 'recipeid' :
                        'employeeid';
                    newRow.dataset.id = result[idKey];
                    // Disable editing and remove buttons
                    newRow.querySelectorAll('.cell').forEach(cell => {
                        cell.contentEditable = false;
                        cell.classList.remove('editable');
                    });
                    saveBtn.remove();
                    cancelBtn.remove();
                    if (descInput) descInput.remove();

                    newRow.appendChild(deleteBtn);
                } else {
                    const text = await res.text();
                    alert('Failed to add item: ' + text);
                }
            } catch (err) {
                console.error(err);
                alert('Error adding item');
            }
        });

        newRow.appendChild(saveBtn);
        newRow.appendChild(cancelBtn);

        // Insert row at the top of the grid
        dataGrid.prepend(newRow);
    }


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

// Below is for recipes

// Add click handlers for all "Add Ingredient" buttons under recipe cards
document.addEventListener('DOMContentLoaded', () => {
    // ... (keep all your existing DOMContentLoaded code above)
    
    // Add this new handler for recipe card buttons
    document.querySelectorAll('.add-ingredient-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.itemid;
            const itemName = btn.dataset.itemname;
            const recipeCard = btn.closest('.recipe-card');
            
            try {
                // Fetch inventory items
                const invRes = await fetch('/manager/inventory');
                if (!invRes.ok) {
                    alert('Failed to load inventory data');
                    return;
                }
                const inventoryItems = await invRes.json();
                
                // Show the add form for this specific recipe card
                showAddIngredientForm(recipeCard, itemId, itemName, inventoryItems);
            } catch (err) {
                console.error('Error fetching inventory:', err);
            }
        });
    });
});

function showAddIngredientForm(recipeCard, itemId, itemName, inventoryItems) {
    // Remove any existing form in this card
    const existingForm = recipeCard.querySelector('.ingredient-add-form');
    if (existingForm) {
        existingForm.remove();
        return; // Toggle behavior - if form exists, remove it
    }
    
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.classList.add('ingredient-add-form');
    formContainer.style.cssText = `
        margin-top: 15px;
        padding: 15px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    // Form title
    const title = document.createElement('div');
    title.style.cssText = 'color: white; font-weight: 600; margin-bottom: 10px; font-size: 14px;';
    title.textContent = `Add ingredient to ${itemName}`;
    formContainer.appendChild(title);
    
    // Helper function to create form groups
    function createFormGroup(labelText, element) {
        const group = document.createElement('div');
        group.style.cssText = 'margin-bottom: 10px;';
        
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.cssText = 'color: white; font-weight: 600; font-size: 13px; display: block; margin-bottom: 5px;';
        
        element.style.cssText = 'width: 100%; padding: 8px; border: none; border-radius: 4px; font-size: 14px; box-sizing: border-box;';
        
        group.appendChild(label);
        group.appendChild(element);
        return group;
    }
    
    // Ingredient select
    const inventorySelect = document.createElement('select');
    inventorySelect.dataset.column = 'inventoryid';
    const defaultInvOption = document.createElement('option');
    defaultInvOption.value = '';
    defaultInvOption.textContent = '-- Select Ingredient --';
    inventorySelect.appendChild(defaultInvOption);
    inventoryItems.forEach(i => {
        const option = document.createElement('option');
        option.value = i.inventoryid;
        option.textContent = i.ingredientname;
        inventorySelect.appendChild(option);
    });
    formContainer.appendChild(createFormGroup('Ingredient', inventorySelect));
    
    // Quantity and Unit row
    const qtyUnitRow = document.createElement('div');
    qtyUnitRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;';
    
    // Quantity input
    const qtyGroup = document.createElement('div');
    const qtyLabel = document.createElement('label');
    qtyLabel.textContent = 'Quantity';
    qtyLabel.style.cssText = 'color: white; font-weight: 600; font-size: 13px; display: block; margin-bottom: 5px;';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.step = '0.01';
    qtyInput.min = '0';
    qtyInput.value = 1;
    qtyInput.style.cssText = 'width: 100%; padding: 8px; border: none; border-radius: 4px; font-size: 14px; box-sizing: border-box;';
    qtyGroup.appendChild(qtyLabel);
    qtyGroup.appendChild(qtyInput);
    
    // Unit input
    const unitGroup = document.createElement('div');
    const unitLabel = document.createElement('label');
    unitLabel.textContent = 'Unit';
    unitLabel.style.cssText = 'color: white; font-weight: 600; font-size: 13px; display: block; margin-bottom: 5px;';
    const unitInput = document.createElement('input');
    unitInput.type = 'text';
    unitInput.placeholder = 'e.g., lbs, oz';
    unitInput.style.cssText = 'width: 100%; padding: 8px; border: none; border-radius: 4px; font-size: 14px; box-sizing: border-box;';
    unitGroup.appendChild(unitLabel);
    unitGroup.appendChild(unitInput);
    
    qtyUnitRow.appendChild(qtyGroup);
    qtyUnitRow.appendChild(unitGroup);
    formContainer.appendChild(qtyUnitRow);
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
    
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Add';
    saveBtn.style.cssText = 'flex: 1; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px;';
    saveBtn.addEventListener('mouseover', () => saveBtn.style.background = '#45a049');
    saveBtn.addEventListener('mouseout', () => saveBtn.style.background = '#4CAF50');
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex: 1; padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px;';
    cancelBtn.addEventListener('mouseover', () => cancelBtn.style.background = '#da190b');
    cancelBtn.addEventListener('mouseout', () => cancelBtn.style.background = '#f44336');
    
    cancelBtn.addEventListener('click', () => formContainer.remove());
    
    saveBtn.addEventListener('click', async () => {
        // Validation
        if (!inventorySelect.value) {
            alert('Please select an ingredient');
            return;
        }
        if (!qtyInput.value || parseFloat(qtyInput.value) <= 0) {
            alert('Please enter a valid quantity');
            return;
        }
        if (!unitInput.value.trim()) {
            alert('Please enter a unit (e.g., lbs, oz, cups)');
            return;
        }
        
        const newData = {
            itemid: parseInt(itemId),
            inventoryid: parseInt(inventorySelect.value),
            quantity: parseFloat(qtyInput.value),
            unit: unitInput.value.trim()
        };
        
        try {
            const res = await fetch('/manager/recipes/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });
            
            if (res.ok) {
                alert('Ingredient added successfully!');
                location.reload();
            } else {
                const text = await res.text();
                alert('Failed to add ingredient: ' + text);
            }
        } catch (err) {
            console.error(err);
            alert('Error adding ingredient');
        }
    });
    
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    formContainer.appendChild(buttonContainer);
    
    // Insert form before the "Add Ingredient" button
    const addBtn = recipeCard.querySelector('.add-ingredient-btn');
    addBtn.parentNode.insertBefore(formContainer, addBtn);
}