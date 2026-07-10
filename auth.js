/**
 * auth.js - Protecao de paginas, sessao e mini menu do perfil.
 * Inclua antes do app.js em todas as paginas protegidas.
 */
(function () {
    const SESSION_KEY = 'informais_session';
    const DATA_PREFIX = 'informais_data_';

    function getSession() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch {
            return null;
        }
    }

    function escapeHTML(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    function getCurrentPage() {
        return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    }

    const page = getCurrentPage();

    if (!getSession() && page !== 'login.html') {
        window.location.replace('login.html');
        throw new Error('Redirecionando para login.');
    }

    window.AuthSession = {
        getUser: getSession,

        initProfileMenu: function () {
            bindProfileMenu();
        },

        logout: function () {
            const session = getSession();
            if (session) {
                const currentData = localStorage.getItem('proledger_app_data');
                if (currentData) {
                    localStorage.setItem(DATA_PREFIX + session.username, currentData);
                }
            }

            sessionStorage.removeItem(SESSION_KEY);
            window.location.replace('login.html');
        },

        syncUserData: function () {
            const session = getSession();
            if (!session) return;

            const currentData = localStorage.getItem('proledger_app_data');
            if (currentData) {
                localStorage.setItem(DATA_PREFIX + session.username, currentData);
            }
        }
    };

    window.addEventListener('beforeunload', () => window.AuthSession.syncUserData());

    document.addEventListener('DOMContentLoaded', bindProfileMenu);

    function bindProfileMenu() {
        if (document.body.dataset.profileMenuBound === 'true') return;
        document.body.dataset.profileMenuBound = 'true';

        document.addEventListener('click', event => {
            const button = event.target.closest('button');
            const icon = button?.querySelector('.material-symbols-outlined');
            const isProfileButton = icon?.textContent.trim() === 'account_circle' || button?.dataset.profileButton === 'true';

            if (!isProfileButton) {
                const menu = document.getElementById('profile-mini-page');
                if (menu && !menu.contains(event.target)) closeProfileMenu();
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            button.dataset.profileButton = 'true';
            toggleProfileMenu(button);
        }, true);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeProfileMenu();
        });
    }

    function toggleProfileMenu(button) {
        let menu = document.getElementById('profile-mini-page');
        const wasOpen = menu && !menu.classList.contains('hidden');

        if (!menu) {
            menu = createProfileMenu();
            document.body.appendChild(menu);
        }

        if (wasOpen) {
            closeProfileMenu();
            return;
        }

        positionProfileMenu(button, menu);
        menu.classList.remove('hidden');
    }

    function createProfileMenu() {
        const session = getSession();
        const userName = session?.name || session?.username || 'Usuario';
        const userLogin = session?.username ? `@${session.username}` : 'Nenhuma conta conectada';

        const menu = document.createElement('div');
        menu.id = 'profile-mini-page';
        menu.className = 'hidden fixed z-[100] w-64 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl overflow-hidden';
        menu.innerHTML = `
            <div class="p-md border-b border-outline-variant bg-surface-container-low">
                <p class="text-title-sm font-headline-md text-on-surface m-0">${escapeHTML(userName)}</p>
                <p class="text-body-sm text-secondary m-0">${escapeHTML(userLogin)}</p>
            </div>
            <div class="p-sm flex flex-col gap-xs">
                <button id="profile-login-btn" type="button"
                    class="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors text-body-sm">
                    <span class="material-symbols-outlined" style="font-size:18px">login</span>
                    Entrar
                </button>
                <button id="profile-logout-btn" type="button"
                    class="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-error hover:bg-error-container transition-colors text-body-sm font-semibold">
                    <span class="material-symbols-outlined" style="font-size:18px">logout</span>
                    Sair
                </button>
            </div>
        `;

        menu.querySelector('#profile-login-btn').addEventListener('click', () => {
            window.AuthSession.logout();
        });

        menu.querySelector('#profile-logout-btn').addEventListener('click', () => {
            window.AuthSession.logout();
        });

        return menu;
    }

    function positionProfileMenu(button, menu) {
        const rect = button.getBoundingClientRect();
        const menuWidth = 256;
        const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));

        menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
        menu.style.left = `${left + window.scrollX}px`;
    }

    function closeProfileMenu() {
        document.getElementById('profile-mini-page')?.classList.add('hidden');
    }
})();
