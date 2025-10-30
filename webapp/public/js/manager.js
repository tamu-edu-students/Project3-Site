
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

document.addEventListener('DOMContentLoaded', () => {
    const sectionMap = {
        'menu items': 'menuitems',
        'inventory items': 'inventory',
        'employees': 'employees'
    };

    const modal = document.getElementById('addModal');
    const closeBtn = modal.querySelector('.close-btn');
    const addForm = document.getElementById('addForm');
    let currentSection = '';

    // Close modal
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    // Attach Add button listeners & show/hide fields dynamically
    document.querySelectorAll('.data-section').forEach(section => {
        const sectionName = sectionMap[section.querySelector('h2').textContent.toLowerCase()];
        const addBtn = section.querySelector('.add-btn');

        addBtn.addEventListener('click', () => {
            currentSection = sectionName;
            addForm.reset();
            modal.style.display = 'block';

            addForm.querySelectorAll('.form-field').forEach(field => {
                const sections = field.dataset.section.split(' ');
                field.style.display = sections.includes(currentSection) ? 'block' : 'none';
            });
        });
    });

    // Handle form submission
    addForm.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(addForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch(`/manager/${currentSection}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                alert('Item added!');
                location.reload();
            } else {
                alert('Failed to add item');
            }
        } catch (err) {
            console.error(err);
            alert('Error adding item');
        } finally {
            modal.style.display = 'none';
        }
    });
});

