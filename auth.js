/**
 * auth.js — Proteção de páginas e gerenciamento de sessão
 * Inclua este script ANTES do app.js em todas as páginas protegidas.
 */
(function () {
    const SESSION_KEY = 'informais_session';
    const DATA_PREFIX = 'informais_data_';

    function getSession() {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
    }

    function getCurrentPage() {
        return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    }

    const session = getSession();
    const page = getCurrentPage();

    // Se não há sessão e não está na página de login, redireciona
    if (!session && page !== 'login.html') {
        window.location.replace('login.html');
        throw new Error('Redirecionando para login.');
    }

    // Expõe funções de sessão globalmente para uso nas páginas
    window.AuthSession = {

        getUser: function () {
            return getSession();
        },

        logout: function () {
            const s = getSession();
            if (s) {
                // Persiste os dados atuais no perfil do usuário antes de sair
                const current = localStorage.getItem('proledger_app_data');
                if (current) {
                    localStorage.setItem(DATA_PREFIX + s.username, current);
                }
            }
            sessionStorage.removeItem(SESSION_KEY);
            window.location.replace('login.html');
        },

        syncUserData: function () {
            const s = getSession();
            if (!s) return;
            const current = localStorage.getItem('proledger_app_data');
            if (current) {
                localStorage.setItem(DATA_PREFIX + s.username, current);
            }
        }
    };

    // Sincroniza dados do usuário ao fechar/sair da página
    window.addEventListener('beforeunload', function () {
        window.AuthSession.syncUserData();
    });

    // Injeta o header de usuário logado nas páginas após o DOM carregar
    document.addEventListener('DOMContentLoaded', function () {
        injectUserBadge();
    });

    function injectUserBadge() {
        if (!session) return;

        // Procura o header existente na página
        const header = document.querySelector('header');
        if (!header) return;

        // Verifica se já existe o badge (evita duplicar)
        if (document.getElementById('auth-user-badge')) return;

        // Cria o badge do usuário logado
        const badge = document.createElement('div');
        badge.id = 'auth-user-badge';
        badge.className = 'flex items-center gap-sm';
        badge.innerHTML = `
            <div class="hidden md:flex items-center gap-xs text-body-sm text-on-surface-variant">
                <span class="material-symbols-outlined" style="font-size:18px">account_circle</span>
                <span class="font-semibold text-primary" id="auth-username-label">${escapeHTML(session.name || session.username)}</span>
            </div>
            <button
                id="auth-logout-btn"
                title="Sair da conta"
                class="flex items-center gap-xs px-sm py-xs rounded-lg border border-outline-variant text-secondary hover:bg-error-container hover:text-on-error-container hover:border-error/20 transition-colors text-label-caps font-label-caps"
            >
                <span class="material-symbols-outlined" style="font-size:16px">logout</span>
                <span class="hidden md:inline uppercase">Sair</span>
            </button>
        `;

        // Insere antes do último elemento do header (botões de ação)
        const lastChild = header.lastElementChild;
        if (lastChild) {
            header.insertBefore(badge, lastChild);
        } else {
            header.appendChild(badge);
        }

        document.getElementById('auth-logout-btn').addEventListener('click', function () {
            if (confirm(`Sair da conta de "${session.name || session.username}"?`)) {
                window.AuthSession.logout();
            }
        });
    }

    function escapeHTML(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        }[c]));
    }
})();
