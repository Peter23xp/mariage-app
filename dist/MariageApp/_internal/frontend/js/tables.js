let allGuests = [];
let tablesData = {}; // Format: { "1": [guest1, guest2], "2": [] }
let draggedGuestId = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchGuests();

    document.getElementById('btn-add-table').addEventListener('click', () => {
        const tableNumbers = Object.keys(tablesData)
            .map(n => parseInt(n))
            .filter(n => !isNaN(n));
        const nextTable = tableNumbers.length > 0 ? Math.max(...tableNumbers) + 1 : 1;
        tablesData[nextTable.toString()] = [];
        renderAll();
    });

    document.getElementById('search-unassigned').addEventListener('input', (e) => {
        renderUnassigned(e.target.value);
    });
});

async function fetchGuests() {
    try {
        const res = await fetch('/admin/invites');
        const data = await res.json();
        if(data.success) {
            allGuests = data.data;
            organizeData();
            renderAll();
        }
    } catch(err) {
        console.error("Erreur de chargement des invités", err);
    }
}

function organizeData() {
    tablesData = {};
    allGuests.forEach(guest => {
        let table = guest.table_numero;
        if (!table || table.trim() === '' || table.toLowerCase() === 'non assigné') {
            table = ''; // unassigned
        }
        
        if (!tablesData[table]) {
            tablesData[table] = [];
        }
        tablesData[table].push(guest);
    });
}

function renderAll() {
    renderUnassigned(document.getElementById('search-unassigned').value);
    renderTables();
}

function renderUnassigned(searchTerm = '') {
    const listEl = document.getElementById('list-unassigned');
    listEl.innerHTML = '';
    
    let unassigned = tablesData[''] || [];
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        unassigned = unassigned.filter(g => 
            g.nom_invite.toLowerCase().includes(term) || 
            (g.couple_nom && g.couple_nom.toLowerCase().includes(term))
        );
    }

    document.getElementById('count-unassigned').textContent = unassigned.length;

    unassigned.forEach(guest => {
        listEl.appendChild(createGuestElement(guest));
    });

    setupDropZone(listEl, '');
}

function renderTables() {
    const gridEl = document.getElementById('tables-grid');
    gridEl.innerHTML = '';

    const tableNames = Object.keys(tablesData).filter(t => t !== '').sort((a,b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if(!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    tableNames.forEach(tableName => {
        const guests = tablesData[tableName] || [];
        
        const card = document.createElement('div');
        card.className = 'table-card';
        
        const header = document.createElement('div');
        header.className = 'table-header';
        
        header.innerHTML = `
            <input type="text" class="table-name-input" value="${tableName}" data-original="${tableName}">
            <span class="table-count">${guests.length} invité(s)</span>
        `;
        card.appendChild(header);

        // Allow renaming tables locally (won't save until a guest drops, but good for UI)
        const input = header.querySelector('input');
        input.addEventListener('change', (e) => {
            const newName = e.target.value.trim();
            const oldName = e.target.dataset.original;
            if(newName && newName !== oldName) {
                tablesData[newName] = tablesData[oldName] || [];
                delete tablesData[oldName];
                
                // Update API for all guests in this table
                tablesData[newName].forEach(async g => {
                    await fetch(`/admin/invites/${g.id}/table`, {
                        method: 'PATCH',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ table_numero: newName })
                    });
                });
                renderAll();
            } else {
                e.target.value = oldName;
            }
        });

        const dropZone = document.createElement('div');
        dropZone.className = 'table-droppable-area draggable-list';
        dropZone.dataset.table = tableName;
        
        guests.forEach(guest => {
            dropZone.appendChild(createGuestElement(guest));
        });

        setupDropZone(dropZone, tableName);
        card.appendChild(dropZone);
        gridEl.appendChild(card);
    });
}

function createGuestElement(guest) {
    const el = document.createElement('div');
    el.className = 'guest-item';
    el.draggable = true;
    el.dataset.id = guest.id;
    
    let coupleText = guest.couple_nom && guest.couple_nom !== guest.nom_invite 
        ? `<span class="guest-couple">${guest.couple_nom}</span>` 
        : '';
    
    // Add roles/diet pills if needed, but keep it simple
    let badges = '';
    if (guest.role && guest.role.toLowerCase() !== 'invité') {
        badges += `<span style="font-size:10px; background:var(--color-primary); color:white; padding:1px 4px; border-radius:4px; margin-right:4px;">${guest.role}</span>`;
    }
    
    el.innerHTML = `
        <div class="guest-info">
            <span>${badges}${guest.nom_invite}</span>
            ${coupleText}
        </div>
        <div class="guest-drag-handle">⋮⋮</div>
    `;

    el.addEventListener('dragstart', (e) => {
        draggedGuestId = guest.id;
        setTimeout(() => el.classList.add('dragging'), 0);
        e.dataTransfer.setData('text/plain', guest.id);
        e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.table-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    });

    return el;
}

function setupDropZone(zone, tableName) {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const card = zone.closest('.table-card');
        if(card) card.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
        const card = zone.closest('.table-card');
        if(card) {
            // Un peu de logique pour éviter le scintillement
            if (!card.contains(e.relatedTarget)) {
                card.classList.remove('drag-over');
            }
        }
    });

    zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        const card = zone.closest('.table-card');
        if(card) card.classList.remove('drag-over');
        
        const guestIdStr = e.dataTransfer.getData('text/plain');
        if(!guestIdStr) return;
        const guestId = parseInt(guestIdStr);

        // Trouver l'invité et son ancienne table
        let guest = null;
        let oldTable = null;
        for (const [tName, guests] of Object.entries(tablesData)) {
            const index = guests.findIndex(g => g.id === guestId);
            if (index !== -1) {
                guest = guests[index];
                oldTable = tName;
                break;
            }
        }

        if (guest && oldTable !== tableName) {
            // Mise à jour de l'UI immédiate (Optimistic UI)
            tablesData[oldTable] = tablesData[oldTable].filter(g => g.id !== guestId);
            if(!tablesData[tableName]) tablesData[tableName] = [];
            guest.table_numero = tableName;
            tablesData[tableName].push(guest);
            renderAll();

            // Appel API en arrière-plan
            try {
                const res = await fetch(`/admin/invites/${guestId}/table`, {
                    method: 'PATCH',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ table_numero: tableName })
                });
                const data = await res.json();
                if(!data.success) {
                    console.error("Erreur serveur:", data.message);
                    fetchGuests(); // Revert si erreur
                }
            } catch(err) {
                console.error("Erreur réseau:", err);
                fetchGuests(); // Revert si erreur
            }
        }
    });
}
