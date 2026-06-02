/**
 * admin.js
 * Gère le tableau de bord d'administration (CRUD, CSV, Génération PDF).
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
        
        // Modal
        modalAdd: document.getElementById('modal-add-invite'),
        formAdd: document.getElementById('form-add-invite'),
        btnAdd: document.getElementById('btn-add-invite'),
        btnCloseModal: document.querySelectorAll('.btn-close-modal'),
        
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
            els.searchInput.addEventListener('input', window.utils.debounce((e) => {
                fetchInvites(e.target.value);
            }, 300));
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
                    table_numero: document.getElementById('input-table').value.trim()
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
                window.location.href = '/';
            });
        }
        
        // Délégation d'événements pour les boutons du tableau
        if (els.tbody) {
            els.tbody.addEventListener('click', handleTableActions);
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
            renderTable();
        }
    }

    // === RENDU TABLEAU ===

    function renderTable() {
        if (!els.tbody) return;
        
        if (invitesList.length === 0) {
            els.tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Aucun invité trouvé.</td></tr>`;
            return;
        }

        let html = '';
        invitesList.forEach(inv => {
            const dateScan = window.utils.formatDate(inv.date_scan);
            const statusClass = inv.statut === 'entré' ? 'status-success' : 'status-warning';
            const statusText = inv.statut === 'entré' ? 'Entré' : 'Attente';
            
            // Le helper escapeHtml garantit qu'il n'y a pas d'XSS
            const e = window.utils.escapeHtml;
            
            html += `
                <tr data-id="${inv.id}">
                    <td>${inv.id}</td>
                    <td>
                        <strong>${e(inv.nom_invite)}</strong><br>
                        <small style="color:#aaa;">${e(inv.couple_nom)}</small>
                    </td>
                    <td>
                        <div class="qr-thumbnail" title="${e(inv.code_qr)}">
                            <img src="/qrcodes/${e(inv.code_qr)}.png" alt="QR" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\'><rect width=\\'40\\' height=\\'40\\' fill=\\'%23333\\'/></svg>'">
                        </div>
                    </td>
                    <td>Table ${e(inv.table_numero)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${dateScan}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon btn-edit" title="Modifier" data-action="edit" data-id="${inv.id}">✏️</button>
                            <button class="btn-icon btn-pdf" title="Télécharger PDF" data-action="pdf" data-id="${inv.id}">📄</button>
                            <button class="btn-icon btn-delete" title="Supprimer" data-action="delete" data-id="${inv.id}">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        els.tbody.innerHTML = html;
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
});
