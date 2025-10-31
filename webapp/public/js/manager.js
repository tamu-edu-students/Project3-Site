
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

        editBtn.addEventListener('click', (event) => {
            event.stopPropagation();

            // Prevent edit mode from activating if delete mode is active
            if (dataGrid.classList.contains('show-deletes')) {
                alert('Exit delete mode before editing.');
                return;
            }

            enterEditMode(section, sectionName, editBtn, dataGrid);
        });
    });
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
                if (['itemprice', 'ingredientquantity'].includes(cell.dataset.column)) {
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


//Add Item Modal Logic (commented out for now)
// document.addEventListener('DOMContentLoaded', () => {
//     const sectionMap = {
//         'menu items': 'menuitems',
//         'inventory items': 'inventory',
//         'employees': 'employees'
//     };

//     const modal = document.getElementById('addModal');
//     const closeBtn = modal.querySelector('.close-btn');
//     const addForm = document.getElementById('addForm');
//     let currentSection = '';

//     // Close modal
//     closeBtn.addEventListener('click', () => modal.style.display = 'none');
//     window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

//     // Attach Add button listeners & show/hide fields dynamically
//     document.querySelectorAll('.data-section').forEach(section => {
//         const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
//         const addBtn = section.querySelector('.add-btn');

//         addBtn.addEventListener('click', () => {
//             currentSection = sectionName;
//             addForm.reset();
//             modal.style.display = 'block';

//             addForm.querySelectorAll('.form-field').forEach(field => {
//                 const sections = field.dataset.section.split(' ');
//                 field.style.display = sections.includes(currentSection) ? 'block' : 'none';
//             });
//         });
//     });

//     // Handle form submission
//     addForm.addEventListener('submit', async e => {
//         e.preventDefault();
//         const formData = new FormData(addForm);
//         const data = Object.fromEntries(formData.entries());

//         try {
//             const res = await fetch(`/manager/${currentSection}/add`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(data)
//             });

//             if (res.ok) {
//                 alert('Item added!');
//                 location.reload();
//             } else {
//                 alert('Failed to add item');
//             }
//         } catch (err) {
//             console.error(err);
//             alert('Error adding item');
//         } finally {
//             modal.style.display = 'none';
//         }
//     });
// });


document.querySelectorAll('.data-section').forEach(section => {
    const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
    const addBtn = section.querySelector('.add-btn');
    const dataGrid = section.querySelector('.data-grid');

    addBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        addNewRow(section, sectionName, dataGrid);
    });
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
            if (['itemprice', 'ingredientquantity'].includes(cell.dataset.column)) {
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
    } else {
      // Switch back to "-"
      deleteToggleBtn.textContent = "-";
      deleteToggleBtn.classList.remove('active');
    }
  });
});

