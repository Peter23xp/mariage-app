/**
 * login.js
 * Gère l'interface de connexion à l'espace administration.
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('admin-password');
    const toggleBtn = document.getElementById('toggle-password');
    const errorMsg = document.getElementById('login-error');
    const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    const btnBack = document.getElementById('btn-back');

    // 1. Focus automatique
    if (passwordInput) {
        passwordInput.focus();
    }

    // 2. Retour à l'accueil
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    // 3. Afficher/Masquer le mot de passe
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.textContent = '👁️‍🗨️'; // Masquer (icône temporaire ou utiliser une icône SVG/feather existante)
            } else {
                passwordInput.type = 'password';
                toggleBtn.textContent = '👁️'; // Afficher
            }
        });
    }

    // 4. Soumission du formulaire
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Empêche le rechargement de la page
            
            const password = passwordInput.value.trim();
            if (!password) {
                showError("Veuillez entrer un mot de passe.");
                return;
            }

            // UI Feedback
            hideError();
            setLoading(true);

            // Appel API
            const response = await window.api.login(password);

            if (response.success) {
                // Stocke un token éphémère dans la session courante
                sessionStorage.setItem('admin_authenticated', 'true');
                window.utils.showToast("Connexion réussie", "success");
                
                // Redirection
                setTimeout(() => {
                    window.location.href = '/admin.html';
                }, 500);
            } else {
                showError(response.message || "Mot de passe incorrect.");
                passwordInput.value = '';
                passwordInput.focus();
                setLoading(false);
            }
        });
    }

    // -- Helpers locaux --
    function showError(msg) {
        if (errorMsg) {
            errorMsg.textContent = msg;
            errorMsg.classList.remove('hidden');
        }
    }

    function hideError() {
        if (errorMsg) {
            errorMsg.classList.add('hidden');
            errorMsg.textContent = '';
        }
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'Connexion...';
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'Se connecter';
        }
    }
});
