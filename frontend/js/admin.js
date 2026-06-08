/**
 * admin.js
 * Gère le tableau de bord d'administration (CRUD, CSV, filtres, actions en masse).
 */

document.addEventListener('DOMContentLoaded', () => {
    // === VÉRIFICATION AUTHENTIFICATION ===
    if (sessionStorage.getItem('admin_authenticated') !== 'true') {
        window.location.href = '/login.html';
        return;
    }

    // === CONSTANTES & DOM ===
    const POLL_INTERVAL = 10000; // 10 secondes
    
    const els = {
        // Stats
        statTotal: document.getElementById('stat-total'),
        statEntered: document.getElementById('stat-entered'),
        statWaiting: document.getElementById('stat-waiting'),
        statRate: document.getElementById('stat-rate'),
        
        // Tableau
        tbody: document.getElementById('invites-tbody'),
        searchInput: document.getElementById('search-input'),
        selectAll: document.getElementById('select-all'),
        
        // Filtres
        filterStatus: document.getElementById('filter-status'),
        filterTable: document.getElementById('filter-table'),
        sortBy: document.getElementById('sort-by'),
        
        // Bulk actions
        bulkActionsBar: document.getElementById('bulk-actions-bar'),
        bulkCount: document.getElementById('bulk-count'),
        btnBulkExport: document.getElementById('btn-bulk-export'),
        btnBulkDelete: document.getElementById('btn-bulk-delete'),
        
        // Modal
        modalAdd: document.getElementById('modal-add-invite'),
        formAdd: document.getElementById('form-add-invite'),
        btnAdd: document.getElementById('btn-add-invite'),
        btnCloseModal: document.querySelectorAll('.btn-close-modal'),
        
        // Modal Network Info
        modalNetworkInfo: document.getElementById('modal-network-info'),
        btnNetworkInfo: document.getElementById('btn-network-info'),
        btnCloseModalNetwork: document.querySelector('.btn-close-modal-network'),
        
        // Actions globales
        btnImportCsv: document.getElementById('btn-import-csv'),
        inputCsv: document.getElementById('csv-input'),
        btnExportCsv: document.getElementById('btn-export-csv'),
        btnGenPdfAll: document.getElementById('btn-generate-pdf'),
        
        // Navigation
        btnLogout: document.getElementById('btn-logout'),
        btnBack: document.getElementById('btn-back-scan')
    };

    let invitesList = []; // État local
    let selectedInvites = new Set(); // IDs des invités sélectionnés
    let allTables = []; // Liste de toutes les tables

    // === INITIALISATION ===
    
    function init() {
        fetchStats();
        fetchInvites();

        setInterval(() => {
            fetchStats();
            // On ne rafraîchit pas le tableau si l'utilisateur est en train de chercher
            if (!els.searchInput || els.searchInput.value === '') {
                fetchInvites();
            }
        }, POLL_INTERVAL);

        bindEvents();
    }

    function bindEvents() {
        // Recherche avec debounce
        if (els.searchInput) {
            els.searchInput.addEventListener('input', window.utils.debounce(() => {
                applyFilters();
            }, 300));
        }

        // Filtres
        if (els.filterStatus) {
            els.filterStatus.addEventListener('change', applyFilters);
        }
        if (els.filterTable) {
            els.filterTable.addEventListener('change', applyFilters);
        }
        if (els.sortBy) {
            els.sortBy.addEventListener('change', applyFilters);
        }

        // Select All
        if (els.selectAll) {
            els.selectAll.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.invite-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) {
                        selectedInvites.add(parseInt(cb.dataset.id));
                    } else {
                        selectedInvites.delete(parseInt(cb.dataset.id));
                    }
                });
                updateBulkActions();
            });
        }

        // Bulk actions
        if (els.btnBulkExport) {
            els.btnBulkExport.addEventListener('click', bulkExport);
        }
        if (els.btnBulkDelete) {
            els.btnBulkDelete.addEventListener('click', bulkDelete);
        }

        // Modal Ajout
        if (els.btnAdd && els.modalAdd) {
            els.btnAdd.addEventListener('click', () => {
                els.formAdd.reset();
                els.formAdd.dataset.mode = 'add';
                document.getElementById('modal-title').textContent = 'Ajouter un invité';
                els.modalAdd.classList.remove('hidden');
            });
        }

        if (els.btnCloseModal) {
            els.btnCloseModal.forEach(btn => {
                btn.addEventListener('click', () => {
                    els.modalAdd.classList.add('hidden');
                });
            });
        }

        // Modal Network Info
        if (els.btnNetworkInfo) {
            els.btnNetworkInfo.addEventListener('click', showNetworkInfo);
        }

        if (els.btnCloseModalNetwork) {
            els.btnCloseModalNetwork.addEventListener('click', () => {
                els.modalNetworkInfo.classList.add('hidden');
            });
        }

        // Copy buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-copy')) {
                const type = e.target.dataset.copy;
                copyNetworkURL(type, e.target);
            }
        });

        // Formulaire Ajout / Edition
        if (els.formAdd) {
            els.formAdd.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSubmit = els.formAdd.querySelector('button[type="submit"]');
                const originalText = btnSubmit.textContent;
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Enregistrement...';

                const data = {
                    nom_invite: document.getElementById('input-nom').value.trim(),
                    couple_nom: document.getElementById('input-couple').value.trim(),
                    table_numero: document.getElementById('input-table').value.trim(),
                    role: document.getElementById('input-role').value,
                    regime_alimentaire: document.getElementById('input-regime').value,
                    accompagnants: parseInt(document.getElementById('input-accomp').value) || 0
                };

                const mode = els.formAdd.dataset.mode;
                const id = els.formAdd.dataset.editId;
                
                let res;
                if (mode === 'edit' && id) {
                    res = await window.api.updateInvite(id, data);
                } else {
                    res = await window.api.addInvite(data);
                }

                if (res.success) {
                    window.utils.showToast(res.message || "Enregistré avec succès", "success");
                    els.modalAdd.classList.add('hidden');
                    fetchInvites(els.searchInput ? els.searchInput.value : '');
                    fetchStats();
                } else {
                    window.utils.showToast(res.message, "error");
                }

                btnSubmit.disabled = false;
                btnSubmit.textContent = originalText;
            });
        }

        // CSV Import
        if (els.btnImportCsv && els.inputCsv) {
            els.btnImportCsv.addEventListener('click', () => els.inputCsv.click());
            els.inputCsv.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                window.utils.showToast("Importation en cours...", "info");
                const res = await window.api.importCSV(file);
                
                if (res.success) {
                    window.utils.showToast(res.message, "success");
                    fetchInvites();
                    fetchStats();
                } else {
                    window.utils.showToast(res.message, "error");
                }
                els.inputCsv.value = ''; // Reset input
            });
        }

        // CSV Export
        if (els.btnExportCsv) {
            els.btnExportCsv.addEventListener('click', async () => {
                window.utils.showToast("Génération de l'export CSV...", "info");
                const res = await window.api.exportCSV();
                if (res.success && res.isBlob) {
                    const filename = `invites_mariage_${new Date().getTime()}.csv`;
                    window.utils.downloadBlob(res.blob, filename);
                } else {
                    window.utils.showToast("Erreur lors de l'export.", "error");
                }
            });
        }

        // Generer tous les PDF
        if (els.btnGenPdfAll) {
            els.btnGenPdfAll.addEventListener('click', async () => {
                const confirmed = await window.utils.confirmDialog("Voulez-vous regénérer TOUS les PDFs ? Cela peut prendre du temps.");
                if (!confirmed) return;
                
                window.utils.showToast("Génération des PDFs en cours...", "info");
                const res = await window.api.generateAllPDF();
                if (res.success) {
                    window.utils.showToast(res.message || "PDFs générés avec succès", "success");
                } else {
                    window.utils.showToast(res.message, "error");
                }
            });
        }

        // Navigation
        if (els.btnLogout) {
            els.btnLogout.addEventListener('click', () => {
                sessionStorage.removeItem('admin_authenticated');
                window.location.href = '/login.html';
            });
        }
        
        if (els.btnBack) {
            els.btnBack.addEventListener('click', () => {
                window.location.href = '/scan.html';
            });
        }
        
        // Délégation d'événements pour les boutons du tableau
        if (els.tbody) {
            els.tbody.addEventListener('click', handleTableActions);
            els.tbody.addEventListener('change', handleCheckboxChange);
        }
    }

    // === DATA FETCHING ===

    async function fetchStats() {
        const res = await window.api.getAdminStats();
        if (res.success && res.data) {
            if (els.statTotal) els.statTotal.textContent = res.data.total;
            if (els.statEntered) els.statEntered.textContent = res.data.entres;
            if (els.statWaiting) els.statWaiting.textContent = res.data.attente;
            
            if (els.statRate && res.data.total > 0) {
                const rate = Math.round((res.data.entres / res.data.total) * 100);
                els.statRate.textContent = rate + '%';
            }
        }
    }

    async function fetchInvites(search = '') {
        const res = await window.api.getInvites(search);
        if (res.success) {
            invitesList = res.data;
            extractTables();
            applyFilters();
        }
    }

    // === FILTRES & TRI ===

    function extractTables() {
        const tables = [...new Set(invitesList.map(inv => inv.table_numero))].sort();
        allTables = tables;
        
        // Populer le filtre de tables
        if (els.filterTable) {
            const currentValue = els.filterTable.value;
            els.filterTable.innerHTML = '<option value="all">Toutes</option>';
            tables.forEach(table => {
                const opt = document.createElement('option');
                opt.value = table;
                opt.textContent = `Table ${table}`;
                els.filterTable.appendChild(opt);
            });
            els.filterTable.value = currentValue;
        }
    }

    function applyFilters() {
        let filtered = [...invitesList];

        // Filtre par recherche
        const searchTerm = els.searchInput ? els.searchInput.value.toLowerCase() : '';
        if (searchTerm) {
            filtered = filtered.filter(inv => 
                inv.nom_invite.toLowerCase().includes(searchTerm) ||
                inv.code_qr.toLowerCase().includes(searchTerm) ||
                inv.couple_nom.toLowerCase().includes(searchTerm)
            );
        }

        // Filtre par statut
        const statusFilter = els.filterStatus ? els.filterStatus.value : 'all';
        if (statusFilter !== 'all') {
            filtered = filtered.filter(inv => inv.statut === statusFilter);
        }

        // Filtre par table
        const tableFilter = els.filterTable ? els.filterTable.value : 'all';
        if (tableFilter !== 'all') {
            filtered = filtered.filter(inv => inv.table_numero === tableFilter);
        }

        // Tri
        const sortBy = els.sortBy ? els.sortBy.value : 'nom';
        filtered.sort((a, b) => {
            switch(sortBy) {
                case 'nom':
                    return a.nom_invite.localeCompare(b.nom_invite);
                case 'date_scan':
                    if (!a.date_scan) return 1;
                    if (!b.date_scan) return -1;
                    return new Date(b.date_scan) - new Date(a.date_scan);
                case 'table':
                    return a.table_numero.localeCompare(b.table_numero);
                case 'statut':
                    return a.statut.localeCompare(b.statut);
                default:
                    return 0;
            }
        });

        renderTable(filtered);
    }

    // === RENDU TABLEAU ===

    function renderTable(filteredList = invitesList) {
        if (!els.tbody) return;
        
        if (filteredList.length === 0) {
            els.tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Aucun invité trouvé.</td></tr>`;
            return;
        }

        let html = '';
        filteredList.forEach(inv => {
            const dateScan = window.utils.formatDate(inv.date_scan);
            const statusClass = inv.statut === 'entré' ? 'status-success' : 'status-warning';
            const statusText = inv.statut === 'entré' ? 'Entré' : 'Attente';
            const isChecked = selectedInvites.has(inv.id) ? 'checked' : '';
            
            const e = window.utils.escapeHtml;
            
            let roleBadge = '';
            if (inv.role === 'vip') roleBadge = '<span style="background:var(--color-brand-warn); color:white; padding: 2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">VIP</span>';
            else if (inv.role === 'temoin') roleBadge = '<span style="background:#3b82f6; color:white; padding: 2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Témoin</span>';
            
            let extraInfo = '';
            if (inv.regime_alimentaire && inv.regime_alimentaire !== 'Aucun') {
                extraInfo += `<br><small style="color:var(--color-brand-error);">🍽️ ${e(inv.regime_alimentaire)}</small>`;
            }
            if (inv.accompagnants && inv.accompagnants > 0) {
                extraInfo += `<br><small style="color:var(--color-slate);">👥 +${inv.accompagnants} pers.</small>`;
            }

            html += `
                <tr data-id="${inv.id}">
                    <td class="checkbox-cell">
                        <input type="checkbox" class="invite-checkbox" data-id="${inv.id}" ${isChecked}>
                    </td>
                    <td>${e(inv.code_qr)}</td>
                    <td>
                        <strong>${roleBadge}${e(inv.nom_invite)}</strong><br>
                        <small style="color:var(--color-steel);">${e(inv.couple_nom)}</small>
                    </td>
                    <td>${extraInfo || '<small style="color:var(--color-stone)">—</small>'}</td>
                    <td>
                        <div class="qr-thumbnail" title="${e(inv.code_qr)}">
                            <img src="/qrcodes/${e(inv.code_qr)}.png" alt="QR" onerror="this.style.display='none'">
                        </div>
                    </td>
                    <td>Table ${e(inv.table_numero)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${dateScan}</td>
                    <td>
                        <div class="table-actions">
                            <button data-action="edit" data-id="${inv.id}">Modifier</button>
                            <button data-action="pdf" data-id="${inv.id}">PDF</button>
                            <button class="danger" data-action="delete" data-id="${inv.id}">Supprimer</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        els.tbody.innerHTML = html;
    }

    // === GESTIONNAIRE D'ACTIONS TABLEAU ===

    // === CHECKBOX HANDLING ===

    function handleCheckboxChange(e) {
        if (e.target.classList.contains('invite-checkbox')) {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) {
                selectedInvites.add(id);
            } else {
                selectedInvites.delete(id);
            }
            updateBulkActions();
        }
    }

    function updateBulkActions() {
        const count = selectedInvites.size;
        if (count > 0) {
            els.bulkActionsBar.classList.remove('hidden');
            els.bulkCount.textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
        } else {
            els.bulkActionsBar.classList.add('hidden');
        }

        // Update select all checkbox state
        const totalCheckboxes = document.querySelectorAll('.invite-checkbox').length;
        if (els.selectAll) {
            els.selectAll.checked = count === totalCheckboxes && count > 0;
        }
    }

    // === BULK ACTIONS ===

    async function bulkExport() {
        if (selectedInvites.size === 0) return;
        
        const selectedData = invitesList.filter(inv => selectedInvites.has(inv.id));
        
        // Créer un CSV avec les invités sélectionnés
        let csv = 'Code QR,Nom Invité,Couple,Table,Statut,Date Scan\n';
        selectedData.forEach(inv => {
            csv += `"${inv.code_qr}","${inv.nom_invite}","${inv.couple_nom}","${inv.table_numero}","${inv.statut}","${inv.date_scan || ''}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const filename = `selection_${selectedInvites.size}_invites_${new Date().getTime()}.csv`;
        window.utils.downloadBlob(blob, filename);
        
        window.utils.showToast(`${selectedInvites.size} invités exportés`, "success");
    }

    async function bulkDelete() {
        if (selectedInvites.size === 0) return;
        
        const confirmed = await window.utils.confirmDialog(
            `Voulez-vous vraiment supprimer ${selectedInvites.size} invité${selectedInvites.size > 1 ? 's' : ''} ? Cette action est irréversible.`
        );
        
        if (!confirmed) return;
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const id of selectedInvites) {
            const res = await window.api.deleteInvite(id);
            if (res.success) {
                successCount++;
            } else {
                errorCount++;
            }
        }
        
        selectedInvites.clear();
        updateBulkActions();
        
        if (errorCount === 0) {
            window.utils.showToast(`${successCount} invité${successCount > 1 ? 's' : ''} supprimé${successCount > 1 ? 's' : ''}`, "success");
        } else {
            window.utils.showToast(`${successCount} supprimés, ${errorCount} erreur(s)`, "warning");
        }
        
        fetchInvites();
        fetchStats();
    }

    // === GESTIONNAIRE D'ACTIONS TABLEAU ===

    async function handleTableActions(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;
        
        if (action === 'delete') {
            const confirmed = await window.utils.confirmDialog("Voulez-vous vraiment supprimer cet invité ? Cette action est irréversible.");
            if (confirmed) {
                const res = await window.api.deleteInvite(id);
                if (res.success) {
                    window.utils.showToast("Invité supprimé.", "success");
                    selectedInvites.delete(parseInt(id));
                    updateBulkActions();
                    fetchInvites(els.searchInput ? els.searchInput.value : '');
                    fetchStats();
                } else {
                    window.utils.showToast(res.message, "error");
                }
            }
        } 
        else if (action === 'edit') {
            const invite = invitesList.find(i => i.id == id);
            if (invite) {
                document.getElementById('input-nom').value = invite.nom_invite;
                document.getElementById('input-couple').value = invite.couple_nom;
                document.getElementById('input-table').value = invite.table_numero;
                document.getElementById('input-role').value = invite.role || 'invité';
                document.getElementById('input-regime').value = invite.regime_alimentaire || 'Aucun';
                document.getElementById('input-accomp').value = invite.accompagnants || 0;
                
                els.formAdd.dataset.mode = 'edit';
                els.formAdd.dataset.editId = id;
                document.getElementById('modal-title').textContent = 'Modifier un invité';
                els.modalAdd.classList.remove('hidden');
            }
        }
        else if (action === 'pdf') {
            window.utils.showToast("Génération du PDF...", "info");
            const res = await window.api.generatePDF(id);
            if (res.success && res.isBlob) {
                window.utils.downloadBlob(res.blob, `Invitation_${id}.pdf`);
            } else {
                window.utils.showToast("Erreur de génération PDF", "error");
            }
        }
    }

    // GO
    init();

    // === NETWORK INFO FUNCTIONS ===

    async function showNetworkInfo() {
        try {
            const response = await fetch('/api/network-info');
            const data = await response.json();

            // Afficher les URLs
            document.getElementById('network-welcome-url').textContent = data.urls.welcome;
            document.getElementById('network-scan-url').textContent = data.urls.scan;
            document.getElementById('network-admin-url').textContent = data.urls.admin;

            // Afficher les infos
            document.getElementById('network-local-ip').textContent = data.local_ip;
            document.getElementById('network-port').textContent = data.port;
            document.getElementById('network-protocol').textContent = data.protocol.toUpperCase();

            // Sauvegarder pour les copies
            window.networkData = data;

            // Afficher la modal
            els.modalNetworkInfo.classList.remove('hidden');
        } catch (error) {
            console.error('Erreur lors du chargement des infos réseau:', error);
            window.utils.showToast('Erreur de chargement des infos réseau', 'error');
        }
    }

    async function copyNetworkURL(type, button) {
        if (!window.networkData) return;

        const url = window.networkData.urls[type];
        if (!url) return;

        try {
            await navigator.clipboard.writeText(url);
            const originalText = button.textContent;
            button.textContent = 'Copié !';
            button.style.background = '#15803d';

            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Erreur de copie:', error);
            window.utils.showToast('Erreur de copie', 'error');
        }
    }
});
