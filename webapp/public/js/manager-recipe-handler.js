

// Add click handlers for all "Add Ingredient" buttons under recipe cards
document.addEventListener('DOMContentLoaded', () => {
    // ... (keep all your existing DOMContentLoaded code above)
    
    // Add this new handler for recipe card buttons
    document.querySelectorAll('.add-ingredient-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
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
                if(res.ok) location.reload();
                else alert('Failed to add ingredient');
            });
        });

    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.edit-ingredient-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const li = btn.closest('.recipe-item');

            const recipeId = li.dataset.id;
            const currentInventoryId = li.dataset.inventoryid;
            const currentQty = parseFloat(li.dataset.quantity);
            const currentUnit = li.dataset.unit;
            const recipeCard = li.closest('.recipe-card');

            // Fetch inventory
            const invRes = await fetch('/manager/inventory');
            if (!invRes.ok) { alert('Failed to load inventory'); return; }
            const inventoryItems = await invRes.json();

            showEditIngredientForm(recipeCard, li, recipeId, currentInventoryId, currentQty, currentUnit, inventoryItems);
        });
    });
});

function createIngredientModal(titleText, inventoryItems, defaultValues = {}, onSave) {
    // Remove existing modal
    const existing = document.querySelector('.ingredient-modal');
    if (existing) existing.remove();

    // Modal overlay
    const overlay = document.createElement('div');
    overlay.classList.add('ingredient-modal');
    overlay.style.cssText = `
        position: fixed;
        top:0; left:0; right:0; bottom:0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    // Modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        color: black;
        padding: 24px;
        border-radius: 12px;
        width: 400px;
        max-width: 90%;
        box-shadow: 0 6px 12px rgba(0,0,0,0.25);
        display: flex;
        flex-direction: column;
        gap: 16px;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = titleText;
    title.style.cssText = 'margin:0; font-size:18px;';

    // Inventory dropdown
    const select = document.createElement('select');
    select.style.cssText = 'padding:8px; font-size:14px; border-radius:6px; width:100%;';

    if (!defaultValues.inventoryid) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select an ingredient --';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);
    }

    inventoryItems.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.inventoryid;
        opt.textContent = i.ingredientname;

        if (defaultValues.inventoryid != null && Number(i.inventoryid) === Number(defaultValues.inventoryid)) {
            opt.selected = true;
        }


        select.appendChild(opt);
    });

    // Quantity
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.step = '0.01';
    qtyInput.min = '0';
    qtyInput.value = defaultValues.quantity ?? 1;
    qtyInput.placeholder = 'Quantity';
    qtyInput.style.cssText = 'padding:8px; border-radius:6px; font-size:14px; width:100%;';

    // Unit
    const unitInput = document.createElement('input');
    unitInput.type = 'text';
    unitInput.value = defaultValues.unit ?? '';
    unitInput.placeholder = 'Unit (e.g., lbs, oz)';
    unitInput.style.cssText = 'padding:8px; border-radius:6px; font-size:14px; width:100%;';

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:10px; justify-content:flex-end;';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding:8px 16px; border:none; border-radius:6px; background:#4CAF50; color:white; cursor:pointer;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:8px 16px; border:none; border-radius:6px; background:#f44336; color:white; cursor:pointer;';

    cancelBtn.addEventListener('click', () => overlay.remove());
    saveBtn.addEventListener('click', () => {
        if (!select.value) return alert('Select an ingredient');
        if (!qtyInput.value || parseFloat(qtyInput.value) <= 0) return alert('Enter valid quantity');
        if (!unitInput.value.trim()) return alert('Enter a unit');
        onSave({
            inventoryid: parseInt(select.value),
            quantity: parseFloat(qtyInput.value),
            unit: unitInput.value.trim()
        });
        overlay.remove();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    modal.appendChild(title);
    modal.appendChild(select);
    modal.appendChild(qtyInput);
    modal.appendChild(unitInput);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}


document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.edit-ingredient-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();

            // Find the li and recipe info
            const li = btn.closest('.recipe-item');
            const recipeId = li.dataset.id;
            const itemName = li.dataset.itemname || li.dataset.name || 'this item'; // fallback if dataset.itemname missing
            const currentInventoryId = li.dataset.inventoryid;
            const currentQty = parseFloat(li.dataset.quantity);
            const currentUnit = li.dataset.unit;

            // Fetch inventory
            const res = await fetch('/manager/inventory');
            if (!res.ok) return alert('Failed to load inventory');
            const inventoryItems = await res.json();

            // Use modal for editing
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
                if (updateRes.ok) location.reload();
                else alert('Failed to update ingredient');
            });
        });
    });
});
