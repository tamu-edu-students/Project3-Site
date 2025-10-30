
const sectionMap = {
    'menu items': 'menuitems',
    'inventory items': 'inventory',
    'employees': 'employees'
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.data-section').forEach(section => {
        const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
        const editBtn = section.querySelector('.update-btn');
        const dataGrid = section.querySelector('.data-grid');

        editBtn.addEventListener('click', () => enterEditMode(section, sectionName, editBtn, dataGrid));
    });
});

function enterEditMode(section, sectionName, editBtn, dataGrid) {
    // Replace Edit with Save + Cancel
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('add-btn');

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('update-btn');

    const controls = editBtn.parentElement;
    controls.replaceChild(saveBtn, editBtn);
    controls.appendChild(cancelBtn);

    // Make all cells editable
    dataGrid.querySelectorAll('.cell').forEach(cell => {
        cell.contentEditable = true;
        cell.classList.add('editable');
    });

    // Handle Save click
    saveBtn.addEventListener('click', async () => {
        const updates = [];

        dataGrid.querySelectorAll('.data-row').forEach(row => {
            const id = row.dataset.id;
            const updatedData = {};
            row.querySelectorAll('.cell').forEach(cell => {
                const column = cell.dataset.column;
                updatedData[column] = cell.textContent.trim();
            });
            updates.push({ id, ...updatedData });
        });

        // Send updates to server
        for (const item of updates) {
            try {
                await fetch(`/manager/${sectionName}/update/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
            } catch (err) {
                console.error('Error updating item:', err);
            }
        }

        // Exit edit mode
        exitEditMode(dataGrid, saveBtn, cancelBtn, controls);
    });

    // Handle Cancel click
    cancelBtn.addEventListener('click', () => {
        // Reload page or fetch original data again
        window.location.reload();
    });
}

function exitEditMode(dataGrid, saveBtn, cancelBtn, controls) {
    dataGrid.querySelectorAll('.cell').forEach(cell => {
        cell.contentEditable = false;
        cell.classList.remove('editable');
    });

    controls.removeChild(cancelBtn);
    const newEditBtn = document.createElement('button');
    newEditBtn.textContent = 'Edit';
    newEditBtn.classList.add('update-btn');
    controls.replaceChild(newEditBtn, saveBtn);

    // Reattach listener
    newEditBtn.addEventListener('click', () => {
        const section = newEditBtn.closest('.data-section');
        const sectionMap = {
            'menu items': 'menuitems',
            'inventory items': 'inventory',
            'employees': 'employees'
        };
        const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
        const dataGrid = section.querySelector('.data-grid');
        enterEditMode(section, sectionName, newEditBtn, dataGrid);
    });
}

