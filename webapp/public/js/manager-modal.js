
 // Make sure x button in add modal works
document.querySelector('#addModal .close-btn').onclick = function() {
    document.getElementById('addModal').style.display = "none";
};

window.showToast = function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");

    toast.classList.add("toast");
    if (type === "error") toast.classList.add("error");
    else toast.classList.add("success");

    toast.textContent = message;
    container.appendChild(toast);

    // Remove after animation completes
    setTimeout(() => toast.remove(), 3500);
}

window.reloadMenuItems = async function() {
    const res = await fetch('/manager/menuitems');
    const menuItems = await res.json();

    const grid = document.querySelector('#menuItemSection .data-grid');
    grid.innerHTML = ''; // Clear old items

    menuItems.forEach(item => {
        const row = document.createElement('div');
        row.classList.add('data-row');
        row.dataset.id = item.itemid;

        row.innerHTML = `
            <div class="cell" data-column="itemname">${item.itemname}</div>
            <div class="price-wrapper">
                <div>$</div>
                <div class="cell" data-column="itemprice">${item.itemprice}</div>
            </div>
            <button onClick="deleteItem('menuitems', ${item.itemid})" class="hidden">DELETE</button>
        `;

        grid.appendChild(row);
    });
}

window.reloadInventoryItems = async function() {
    const res = await fetch('/manager/inventory');
    const inventoryItems = await res.json();

    const grid = document.querySelector('#inventorySection .data-grid'); 
    console.log(grid);
    grid.innerHTML = ''; // Clear existing content

    inventoryItems.forEach(item => {
        const row = document.createElement('div');
        row.classList.add('data-row');
        row.dataset.id = item.inventoryid;

        row.innerHTML = `
            <div class="cell" data-column="ingredientname">${item.ingredientname}</div>
            <div class="price-wrapper">
                <div class="cell" data-column="ingredientquantity">
                    ${item.ingredientquantity}
                </div>
                <div class="cell" data-column="unit">
                    ${item.unit}
                </div>
            </div>
            <button onClick="deleteItem('inventory', ${item.inventoryid})" class="hidden">DELETE</button>
        `;

        grid.appendChild(row);
    });
}

function attachRecipeCardHandlers() {
    document.querySelectorAll('.add-ingredient-btn').forEach(btn => {
        btn.onclick = async () => {
            const itemId = btn.dataset.itemid;
            const itemName = btn.dataset.itemname;
            const res = await fetch('/manager/inventory');
            const inventoryItems = await res.json();

            createIngredientModal(`Add ingredient to ${itemName}`, inventoryItems, {}, async (data) => {
                data.itemid = parseInt(itemId);
                const res = await fetch('/manager/recipes/add', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(data)
                });
                if(res.ok) {
                    reloadRecipes();
                    showToast('Ingredient added successfully!');
                }
                else {
                    alert('Failed to add ingredient');
                }
            });
        };
    });

    document.querySelectorAll('.edit-ingredient-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const li = btn.closest('.recipe-item');
            const recipeId = li.dataset.id;
            const currentInventoryId = li.dataset.inventoryid;
            const currentQty = parseFloat(li.dataset.quantity);
            const currentUnit = li.dataset.unit;
            const itemName = li.dataset.itemname || 'this item';

            const invRes = await fetch('/manager/inventory');
            const inventoryItems = await invRes.json();

            createIngredientModal(`Edit ingredient for ${itemName}`, inventoryItems, {
                inventoryid: currentInventoryId,
                quantity: currentQty,
                unit: currentUnit
            }, async (data) => {
                const updateRes = await fetch(`/manager/recipes/update/${recipeId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (updateRes.ok) {
                    reloadRecipes();
                    showToast('Ingredient updated successfully!');
                } 
                else alert('Failed to update ingredient');
            });
        };
    });
}


window.reloadRecipes = async function() {
    try {
        const res = await fetch('/manager/recipes');
        const recipesData = await res.json();

        const container = document.querySelector('.data-grid.recipes-grid');
        container.innerHTML = ''; // Clear old recipes

        const recipeGroups = Object.values(recipesData);

        if (recipeGroups.length === 0) {
            // Empty state
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('empty-recipes-message');
            emptyMessage.innerHTML = `<p>No recipes yet. Add menu items first, then create recipes for them!</p>`;
            container.appendChild(emptyMessage);
            return;
        }

        recipeGroups.forEach(group => {
            const card = document.createElement('div');
            card.classList.add('recipe-card');
            card.dataset.itemid = group.itemid;

            const header = document.createElement('div');
            header.classList.add('recipe-card-header');
            header.innerHTML = `<h3>${group.itemname}</h3>`;
            card.appendChild(header);

            const ul = document.createElement('ul');
            group.ingredients.forEach(ing => {
                const li = document.createElement('li');
                li.classList.add('recipe-item');
                li.dataset.id = ing.recipeid;
                li.dataset.inventoryid = ing.inventoryid;
                li.dataset.quantity = ing.quantity;
                li.dataset.unit = ing.unit;

                li.innerHTML = `
                    <span class="recipe-text">
                        ${ing.ingredientname} - ${ing.quantity} ${ing.unit}
                    </span>
                    <button onclick="deleteItem('recipes', ${ing.recipeid})" class="hidden">✕</button>
                    <button class="edit-ingredient-btn">Edit</button>
                `;

                ul.appendChild(li);
            });

            card.appendChild(ul);

            const addBtn = document.createElement('button');
            addBtn.classList.add('add-ingredient-btn');
            addBtn.dataset.itemid = group.itemid;
            addBtn.dataset.itemname = group.itemname;
            addBtn.textContent = '+ Add Ingredient';

            card.appendChild(addBtn);

            container.appendChild(card);

            attachRecipeCardHandlers();
        });
    } catch (err) {
        console.error('Failed to reload recipes:', err);
    }
};


window.reloadEmployees = async function() {
    const res = await fetch('/manager/employees');
    const employees = await res.json();

    // Adjust selector if your HTML has a wrapper like #employeeSection
    const grid = document.querySelector('#employeeSection .data-grid'); 

    grid.innerHTML = ''; // Clear old rows

    employees.forEach(emp => {
        const row = document.createElement('div');
        row.classList.add('data-row');
        row.dataset.id = emp.employeeid;

        row.innerHTML = `
            <div class="cell" data-column="employeename">${emp.employeename}</div>
            <div class="cell" data-column="email">${emp.email}</div>
            <div class="cell" data-column="role">${emp.role}</div>
            <button onClick="deleteItem('employees', ${emp.employeeid})" class="hidden">DELETE</button>
        `;

        grid.appendChild(row);
    });
}




async function openAddModal(sectionName) {

    console.log("Add modal opened for section:", sectionName);

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
        addRowBtn.classList.add("btn-add-row");

        form.appendChild(addRowBtn);
        form.appendChild(document.createElement('br'));
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
            remove.classList.add("btn-remove");

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
        form.appendChild(createInputLabel('Email: ', 'email', 'email', true));
        form.appendChild(document.createElement('br'));
        
        // Role dropdown
        const roleLabel = document.createElement('label');
        roleLabel.textContent = 'Role: ';
        const roleSelect = document.createElement('select');
        roleSelect.name = 'role';
        ['manager', 'cashier', 'customer'].forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r.charAt(0).toUpperCase() + r.slice(1); // Capitalize
            roleSelect.appendChild(opt);
        });
        roleLabel.appendChild(roleSelect);
        form.appendChild(roleLabel);

        form.appendChild(document.createElement('br'));
    }

    // Submit + Cancel buttons
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Add';
    submitBtn.classList.add("btn-primary");
    form.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add("btn-secondary");
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
                
                //modal.style.display = 'none';
                //setTimeout(() => location.reload(), 3500); 
                //location.reload();
                if (sectionName === 'inventory') {
                    showToast(`New inventory item added successfully!`);
                    await reloadInventoryItems();
                    modal.style.display = 'none';

                }
                if (sectionName === 'employees') {
                    showToast(`New employee added successfully!`);
                    await reloadEmployees();
                    modal.style.display = 'none';

                }

            } else {
                showToast('Failed to add', 'error');
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

            showToast(`New menu item added successfully!`);
            modal.style.display = 'none';
            //location.reload();
            reloadMenuItems();
            reloadRecipes();

        } catch (err) {
            console.error('Error adding menu item + ingredients:', err);
            alert('Error adding menu item');
        }
    };
}
