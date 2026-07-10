/**
 * auth.js — Proteção de páginas, sessão e dropdown de perfil
 * Inclua ANTES do app.js em todas as páginas protegidas.
 */
(function () {
    const SESSION_KEY = 'informais_session';
    const USERS_KEY   = 'informais_users';
    const DATA_PREFIX = 'informais_data_';

    /* ── Helpers ── */
    function getSession() {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
    }

    function getUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; }
    }

    function escapeHTML(str) {
        return String(str || '').replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])
        );
    }

    function getCurrentPage() {
        return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    }

    /* ── Guarda de rota ── */
    const session = getSession();
    const page    = getCurrentPage();

    if (!session && page !== 'login.html') {
        window.location.replace('login.html');
        throw new Error('Redirecionando para login.');
    }

    /* ── API pública ── */
    window.AuthSession = {
        getUser: getSession,

        initProfileMenu: function () {
            if (getSession()) injectProfileDropdown();
        },

        logout: function () {
            const s = getSession();
            if (s) {
                const current = localStorage.getItem('proledger_app_data');
                if (current) localStorage.setItem(DATA_PREFIX + s.username, current);
            }
            sessionStorage.removeItem(SESSION_KEY);
            window.location.replace('login.html');
        },

        syncUserData: function () {
            const s = getSession();
            if (!s) return;
            const current = localStorage.getItem('proledger_app_data');
            if (current) localStorage.setItem(DATA_PREFIX + s.username, current);
        }
    };

    window.addEventListener('beforeunload', () => window.AuthSession.syncUserData());

    /* ── Dropdown de perfil ── */
    document.addEventListener('DOMContentLoaded', function () {
        if (!session) return;
        bindProfileDelegation();
        injectProfileDropdown();
        setTimeout(injectProfileDropdown, 0);
        // Suprime o toast padrão do app.js no botão account_circle
        suppressDefaultProfileToast();
    });

    function bindProfileDelegation() {
        if (document.body.dataset.profileDelegationBound === 'true') return;
        document.body.dataset.profileDelegationBound = 'true';

        document.addEventListener('click', function (e) {
            const btn = e.target.closest('button');
            if (!btn) return;

            const icon = btn.querySelector('.material-symbols-outlined');
            const isProfileButton = btn.dataset.profileTrigger === 'true' ||
                (icon && icon.textContent.trim() === 'account_circle');

            if (!isProfileButton) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            injectProfileDropdown();
            const dropdown = document.getElementById('profile-dropdown');
            if (!dropdown) return;

            if (btn.dataset.profileTrigger !== 'true') {
                enhanceProfileButton(btn);
                btn.setAttribute('data-profile-trigger', 'true');
            }

            toggleDropdown(btn, dropdown);
        }, true);
    }

    function injectProfileDropdown() {
        // Encontra TODOS os botões account_circle na página
        const profileBtns = Array.from(document.querySelectorAll('button')).filter(btn => {
            const icon = btn.querySelector('.material-symbols-outlined');
            return icon && icon.textContent.trim() === 'account_circle';
        });

        if (!profileBtns.length) return;

        // Cria o dropdown (único, compartilhado)
        let dropdown = document.getElementById('profile-dropdown');
        if (!dropdown) {
            dropdown = buildDropdown();
            document.body.appendChild(dropdown);
        }

        // Associa cada botão de perfil ao dropdown
        profileBtns.forEach(btn => {
            if (btn.dataset.profileTrigger === 'true') return;

            // Melhora a aparência do botão: mostra inicial do nome
            enhanceProfileButton(btn);

            btn.setAttribute('data-profile-trigger', 'true');
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                toggleDropdown(btn, dropdown);
            });
        });

        if (dropdown.dataset.closeEventsBound !== 'true') {
            dropdown.dataset.closeEventsBound = 'true';

            // Fecha ao clicar fora
            document.addEventListener('click', function (e) {
                if (!dropdown.contains(e.target)) {
                    closeDropdown(dropdown);
                }
            });

            // Fecha com ESC
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeDropdown(dropdown);
            });
        }

        // Botão sair dentro do dropdown
        if (dropdown.dataset.actionsBound === 'true') return;
        dropdown.dataset.actionsBound = 'true';

        dropdown.querySelector('#profile-copy-user-btn').addEventListener('click', function () {
            copyUsername(dropdown);
        });

        dropdown.querySelector('#profile-sync-btn').addEventListener('click', function () {
            window.AuthSession.syncUserData();
            showProfileMessage(dropdown, 'Dados da conta salvos neste dispositivo.');
        });

        dropdown.querySelector('#profile-reload-btn').addEventListener('click', function () {
            closeDropdown(dropdown);
            window.location.reload();
        });

        dropdown.querySelector('#profile-logout-btn').addEventListener('click', function () {
            closeDropdown(dropdown);
            showLogoutConfirm();
        });
    }

    function enhanceProfileButton(btn) {
        const initial = (session.name || session.username || '?')[0].toUpperCase();
        // Substitui o ícone genérico por um avatar com inicial
        btn.innerHTML = `
            <span
                class="flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary text-label-caps font-label-caps font-bold select-none"
                title="${escapeHTML(session.name || session.username)}"
                style="font-size:13px; letter-spacing:0"
            >${escapeHTML(initial)}</span>
        `;
        btn.className = 'relative p-0 rounded-full hover:opacity-80 transition-opacity cursor-pointer';
    }

    function buildDropdown() {
        const users    = getUsers();
        const userObj  = users[session.username] || {};
        const loginAt  = session.loginAt ? new Date(session.loginAt) : null;
        const loginStr = loginAt
            ? loginAt.toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
            : '—';

        const div = document.createElement('div');
        div.id = 'profile-dropdown';
        div.className = [
            'hidden fixed z-[90]',
            'w-72 bg-surface-container-lowest',
            'border border-outline-variant rounded-xl shadow-xl',
            'overflow-hidden'
        ].join(' ');

        div.innerHTML = `
            <!-- Cabeçalho do perfil -->
            <div class="flex items-center gap-sm p-md bg-surface-container-low border-b border-outline-variant">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-primary-container text-on-primary text-title-sm font-headline-md font-bold shrink-0 select-none">
                    ${escapeHTML((session.name || session.username || '?')[0].toUpperCase())}
                </div>
                <div class="flex flex-col min-w-0">
                    <span class="text-title-sm font-headline-md text-on-surface truncate" id="pd-fullname">
                        ${escapeHTML(session.name || session.username)}
                    </span>
                    <span class="text-body-sm text-secondary truncate" id="pd-username">
                        @${escapeHTML(session.username)}
                    </span>
                </div>
            </div>

            <!-- Detalhes -->
            <div class="px-md py-sm flex flex-col gap-xs border-b border-outline-variant">
                <div class="flex items-center gap-sm text-body-sm text-on-surface-variant">
                    <span class="material-symbols-outlined" style="font-size:16px">schedule</span>
                    <span>Entrou em <strong class="text-on-surface">${escapeHTML(loginStr)}</strong></span>
                </div>
                <div class="flex items-center gap-sm text-body-sm text-on-surface-variant">
                    <span class="material-symbols-outlined" style="font-size:16px">devices</span>
                    <span>Sessão local neste dispositivo</span>
                </div>
                <div id="profile-action-message" class="hidden text-body-sm text-primary font-semibold"></div>
            </div>

            <!-- Ações -->
            <div class="p-sm flex flex-col gap-xs">
                <button id="profile-copy-user-btn"
                    class="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors text-body-sm"
                    type="button"
                >
                    <span class="material-symbols-outlined" style="font-size:18px">content_copy</span>
                    Copiar usuario
                </button>
                <button id="profile-sync-btn"
                    class="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors text-body-sm"
                    type="button"
                >
                    <span class="material-symbols-outlined" style="font-size:18px">save</span>
                    Salvar dados da conta
                </button>
                <button id="profile-reload-btn"
                    class="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors text-body-sm"
                    type="button"
                >
                    <span class="material-symbols-outlined" style="font-size:18px">refresh</span>
                    Atualizar sistema
                </button>
                <a href="configuracoes.html"
                    class="flex items-center gap-sm px-sm py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors text-body-sm"
                >
                    <span class="material-symbols-outlined" style="font-size:18px">settings</span>
                    Configurações
                </a>
                <button id="profile-logout-btn"
                    class="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-error hover:bg-error-container transition-colors text-body-sm font-semibold"
                >
                    <span class="material-symbols-outlined" style="font-size:18px">logout</span>
                    Sair e entrar com outra conta
                </button>
            </div>
        `;

        return div;
    }

    function showProfileMessage(dropdown, message) {
        const messageBox = dropdown.querySelector('#profile-action-message');
        if (!messageBox) return;
        messageBox.textContent = message;
        messageBox.classList.remove('hidden');
        clearTimeout(showProfileMessage.timer);
        showProfileMessage.timer = setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 2200);
    }

    function copyUsername(dropdown) {
        const text = session.username || '';
        if (!text) return;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => showProfileMessage(dropdown, 'Usuario copiado.'))
                .catch(() => fallbackCopyUsername(dropdown, text));
            return;
        }

        fallbackCopyUsername(dropdown, text);
    }

    function fallbackCopyUsername(dropdown, text) {
        const input = document.createElement('input');
        input.value = text;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();

        try {
            document.execCommand('copy');
            showProfileMessage(dropdown, 'Usuario copiado.');
        } catch (error) {
            showProfileMessage(dropdown, 'Nao foi possivel copiar agora.');
        } finally {
            input.remove();
        }
    }

    function toggleDropdown(btn, dropdown) {
        const isOpen = !dropdown.classList.contains('hidden');
        if (isOpen) {
            closeDropdown(dropdown);
            return;
        }

        // Posiciona o dropdown abaixo do botão
        const rect = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropH = 280; // altura aproximada

        dropdown.classList.remove('hidden');

        const ddWidth = 288; // w-72
        let left = rect.right - ddWidth;
        if (left < 8) left = 8;

        if (spaceBelow >= dropH || spaceBelow > rect.top) {
            // Abre para baixo
            dropdown.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
            dropdown.style.left = left + 'px';
        } else {
            // Abre para cima
            dropdown.style.top  = (rect.top + window.scrollY - dropH - 6) + 'px';
            dropdown.style.left = left + 'px';
        }
    }

    function closeDropdown(dropdown) {
        dropdown.classList.add('hidden');
    }

    function showLogoutConfirm() {
        // Modal de confirmação de logout
        let modal = document.getElementById('logout-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'logout-confirm-modal';
            modal.className = 'hidden fixed inset-0 z-[100] bg-[#00000070] flex items-center justify-center p-md';
            modal.innerHTML = `
                <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                    <div class="flex items-center gap-sm p-md border-b border-outline-variant">
                        <span class="material-symbols-outlined text-error">logout</span>
                        <h3 class="text-title-sm font-headline-md text-on-surface">Sair da conta</h3>
                    </div>
                    <div class="p-md">
                        <p class="text-body-md text-on-surface-variant">
                            Você vai sair da conta
                            <strong class="text-on-surface">${escapeHTML(session.name || session.username)}</strong>.
                            Seus dados ficam salvos para o próximo acesso.
                        </p>
                    </div>
                    <div class="flex justify-end gap-sm p-md border-t border-outline-variant">
                        <button id="logout-cancel-btn"
                            class="px-md py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors font-semibold text-body-sm">
                            Cancelar
                        </button>
                        <button id="logout-confirm-btn"
                            class="px-md py-sm rounded-lg bg-error text-on-error hover:opacity-90 transition-opacity font-semibold text-body-sm flex items-center gap-xs">
                            <span class="material-symbols-outlined" style="font-size:16px">logout</span>
                            Sair
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#logout-cancel-btn').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
            modal.querySelector('#logout-confirm-btn').addEventListener('click', () => {
                window.AuthSession.logout();
            });
            modal.addEventListener('click', e => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
        modal.classList.remove('hidden');
    }

    function suppressDefaultProfileToast() {
        // O app.js adiciona listener de toast no account_circle — como substituímos
        // o botão, o listener antigo não se aplica mais. Nada a fazer aqui,
        // mas mantemos a função caso seja necessário no futuro.
    }
})();
