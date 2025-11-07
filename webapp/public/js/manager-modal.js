
 // Make sure x button in add modal works
document.querySelector('#addModal .close-btn').onclick = function() {
    document.getElementById('addModal').style.display = "none";
};

async function openAddModal(sectionName) {
    const modal = document.getElementById('addModal');
    const form = document.getElementById('addForm');
    
    // Clear previous form content
    form.innerHTML = '';

    // Set modal title
    const title = document.getElementById('addModalTitle') || document.createElement('h3');
    title.id = "addModalTitle";
    title.textContent = `Add ${sectionName === 'menuitems' ? 'Menu Item' :
                          sectionName === 'inventory' ? 'Inventory Item' :
                          sectionName === 'employees' ? 'Employee' : 'Item'}`;
    if (!modal.contains(title)) modal.querySelector('.modal-content').prepend(title);

    // Helper to create labels + inputs
    function createInputLabel(text, name, type = 'text', required = false, step = null) {
        const label = document.createElement('label');
        label.textContent = text;
        const input = document.createElement('input');
        input.name = name;
        input.type = type;
        input.required = required;
        if (step) input.step = step;
        label.appendChild(input);
        return label;
    }

    // Build form fields based on section
    let ingredientRowsContainer = null; // Only used for menuitems
    if (sectionName === 'menuitems') {
        form.appendChild(createInputLabel('Name: ', 'itemname', 'text', true));
        form.appendChild(document.createElement('br'));
        form.appendChild(createInputLabel('Description: ', 'itemdescription'));
        form.appendChild(document.createElement('br'));
        form.appendChild(createInputLabel('Price: ', 'itemprice', 'number', true, '0.01'));
        form.appendChild(document.createElement('hr'));

        const h4 = document.createElement('h4');
        h4.textContent = 'Items Needed';
        form.appendChild(h4);

        ingredientRowsContainer = document.createElement('div');
        ingredientRowsContainer.id = 'recipeIngredientsList';
        form.appendChild(ingredientRowsContainer);

        const addRowBtn = document.createElement('button');
        addRowBtn.type = 'button';
        addRowBtn.textContent = '+ Add Item';
        form.appendChild(addRowBtn);
        form.appendChild(document.createElement('br'));

        // Fetch inventory for select options
        const inventory = await fetch('/manager/inventory').then(res => res.json());

        // Function to add ingredient row
        function addIngredientRow() {
            const row = document.createElement('div');
            row.classList.add('ingredient-row');

            const select = document.createElement('select');
            inventory.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.inventoryid;
                opt.textContent = i.ingredientname;
                select.appendChild(opt);
            });

            const qty = document.createElement('input');
            qty.type = 'number';
            qty.step = '0.01';
            qty.placeholder = 'Qty';

            const unit = document.createElement('input');
            unit.type = 'text';
            unit.placeholder = 'Unit (lbs, pcs, etc)';

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '✕';
            remove.onclick = () => row.remove();

            row.appendChild(select);
            row.appendChild(qty);
            row.appendChild(unit);
            row.appendChild(remove);

            ingredientRowsContainer.appendChild(row);
        }

        addRowBtn.onclick = addIngredientRow;
        addIngredientRow(); // Start with one row by default
    }

    if (sectionName === 'inventory') {
        form.appendChild(createInputLabel('Ingredient: ', 'ingredientname', 'text', true));
        form.appendChild(document.createElement('br'));
        form.appendChild(createInputLabel('Quantity: ', 'ingredientquantity', 'number', true, '0.01'));
        form.appendChild(document.createElement('br'));
        form.appendChild(createInputLabel('Unit: ', 'unit', 'text', true));
        form.appendChild(document.createElement('br'));
    }

    if (sectionName === 'employees') {
        form.appendChild(createInputLabel('Employee Name: ', 'employeename', 'text', true));
        form.appendChild(document.createElement('br'));
    }

    // Submit + Cancel buttons
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Add';
    form.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => { modal.style.display = 'none'; };
    form.appendChild(cancelBtn);

    modal.style.display = 'block';

    // Form submission
    form.onsubmit = async (e) => {
        e.preventDefault();

        if (sectionName !== 'menuitems') {
            // Simple submission for inventory and employees
            const data = Object.fromEntries(new FormData(form));
            const res = await fetch(`/manager/${sectionName}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert('Added!');
                modal.style.display = 'none';
                location.reload();
            } else {
                alert('Failed to add');
            }
            return;
        }

        // Check that at least one ingredient row exists
        const ingredientRows = form.querySelectorAll('.ingredient-row');
        if (ingredientRows.length === 0) {
            alert('You must add at least one ingredient.');
            return;
        }

        // Menu items + ingredients
        const itemData = {
            itemname: form.itemname.value.trim(),
            itemdescription: form.itemdescription.value.trim(),
            itemprice: parseFloat(form.itemprice.value) || 0
        };

        try {
            const itemRes = await fetch('/manager/menuitems/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });

            if (!itemRes.ok) {
                alert('Failed to add menu item');
                return;
            }

            const newItem = await itemRes.json();
            const itemid = newItem.itemid;

            const ingredients = Array.from(form.querySelectorAll('.ingredient-row')).map(row => ({
                itemid,
                inventoryid: row.querySelector('select').value,
                quantity: parseFloat(row.querySelector('input[type="number"]').value) || 0,
                unit: row.querySelector('input[type="text"]').value.trim()
            }));

            for (const ing of ingredients) {
                const res = await fetch('/manager/recipes/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ing)
                });
                if (!res.ok) console.warn('Failed to add recipe:', await res.text());
            }

            alert('Menu item and ingredients added!');
            modal.style.display = 'none';
            location.reload();

        } catch (err) {
            console.error('Error adding menu item + ingredients:', err);
            alert('Error adding menu item');
        }
    };
}
