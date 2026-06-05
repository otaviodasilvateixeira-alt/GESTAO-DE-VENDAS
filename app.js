(function () {
    const STORAGE_KEY = 'proledger_app_data';
    const LOW_STOCK_LIMIT = 5;

    const defaultData = {
        inventory: [
            { id: 'p-1', name: 'Cadeira de Escritorio Ergonomica', sku: 'SKU-OFF-001', category: 'Moveis de Escritorio', qty: 18, cost: 450, price: 850, icon: 'chair' },
            { id: 'p-2', name: 'Monitor Dell 27 4K', sku: 'SKU-ELE-042', category: 'Eletronicos', qty: 8, cost: 1200, price: 2450, icon: 'desktop_windows' },
            { id: 'p-3', name: 'Teclado Mecanico Keychron K8', sku: 'SKU-ACE-089', category: 'Acessorios', qty: 5, cost: 350, price: 680, icon: 'keyboard' },
            { id: 'p-4', name: 'Mesa com Regulagem de Altura', sku: 'SKU-OFF-012', category: 'Moveis de Escritorio', qty: 12, cost: 900, price: 1950, icon: 'desk' }
        ],
        categories: ['Moveis de Escritorio', 'Eletronicos', 'Acessorios', 'Suprimentos'],
        sales: [],
        finance: {
            receivables: [],
            payables: [
                { id: 'pay-1', supplier: 'Aluguel comercial', dueDate: nextDateISO(3), amount: 1500, status: 'Agendado' },
                { id: 'pay-2', supplier: 'Internet e sistemas', dueDate: nextDateISO(6), amount: 180, status: 'Pendente' }
            ]
        },
        settings: {
            lowStockLimit: LOW_STOCK_LIMIT
        }
    };

    const mojibakeMap = {
        'Ã¡': 'á', 'Ã ': 'à', 'Ã¢': 'â', 'Ã£': 'ã', 'Ã¤': 'ä',
        'Ã©': 'é', 'Ãª': 'ê', 'Ã¨': 'è',
        'Ã­': 'í', 'Ã®': 'î',
        'Ã³': 'ó', 'Ã´': 'ô', 'Ãµ': 'õ',
        'Ãº': 'ú', 'Ã¼': 'ü',
        'Ã§': 'ç',
        'Ã�': 'Á', 'Ã€': 'À', 'Ã‚': 'Â', 'Ãƒ': 'Ã',
        'Ã‰': 'É', 'ÃŠ': 'Ê',
        'Ã�': 'Í',
        'Ã“': 'Ó', 'Ã”': 'Ô', 'Ã•': 'Õ',
        'Ãš': 'Ú',
        'Ã‡': 'Ç',
        'Âº': 'º', 'Âª': 'ª'
    };

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function nextDateISO(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().slice(0, 10);
    }

    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn(`Nao foi possivel ler ${key}`, error);
            return fallback;
        }
    }

    function writeData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function toNumber(value, fallback = 0) {
        const number = Number(String(value ?? '').replace(',', '.'));
        return Number.isFinite(number) ? number : fallback;
    }

    const paymentMethods = {
        dinheiro: { label: 'Dinheiro', rate: 0 },
        pix: { label: 'Pix', rate: 0 },
        debito: { label: 'Cartao de debito', rate: 1.99 },
        credito: { label: 'Cartao de credito', rate: 3.49 },
        boleto: { label: 'Boleto bancario', rate: 0 }
    };

    function normalizePaymentMethod(value) {
        const method = normalizeText(value || 'pix').toLowerCase();
        return paymentMethods[method] ? method : 'pix';
    }

    function defaultCardRate(method, installments = 1) {
        const normalized = normalizePaymentMethod(method);
        const baseRate = paymentMethods[normalized].rate;
        if (normalized !== 'credito') return baseRate;
        return baseRate + Math.max(0, toNumber(installments, 1) - 1) * 0.5;
    }

    function calculatePaymentFee(total, feeRate) {
        return Math.max(0, toNumber(total) * (Math.max(0, toNumber(feeRate)) / 100));
    }

    function paymentLabel(method, installments = 1) {
        const normalized = normalizePaymentMethod(method);
        const label = paymentMethods[normalized].label;
        return normalized === 'credito' ? `${label} (${Math.max(1, Math.floor(toNumber(installments, 1)))}x)` : label;
    }

    function normalizeText(value) {
        return String(value ?? '').trim();
    }

    function normalizeSettings(settings = {}) {
        const source = settings || {};
        return {
            lowStockLimit: Math.max(0, Math.floor(toNumber(source.lowStockLimit, LOW_STOCK_LIMIT)))
        };
    }

    function getSettings(data = null) {
        return normalizeSettings(data ? data.settings : getData().settings);
    }

    function normalizeProduct(product, index) {
        const id = normalizeText(product.id || product.codigo || product.sku || `p-${Date.now()}-${index}`);
        const name = normalizeText(product.name || product.nome || product.produto || product.title || `Produto ${index + 1}`);
        return {
            id,
            name,
            sku: normalizeText(product.sku || product.SKU || `SKU-${String(index + 1).padStart(3, '0')}`),
            category: normalizeText(product.category || product.categoria || 'Geral'),
            qty: Math.max(0, Math.floor(toNumber(product.qty ?? product.stock ?? product.quantidade ?? product.quantity))),
            cost: Math.max(0, toNumber(product.cost ?? product.custo ?? product.precoCusto ?? product.preco_custo)),
            price: Math.max(0, toNumber(product.price ?? product.preco ?? product.precoVenda ?? product.valor ?? product.unitPrice)),
            icon: normalizeText(product.icon || 'inventory_2')
        };
    }

    function normalizeCategories(categories, inventory = []) {
        const names = [
            ...asArray(categories).map(normalizeText),
            ...asArray(inventory).map(product => normalizeText(product.category))
        ].filter(Boolean);
        const seen = new Set();
        return names.filter(name => {
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function normalizeSale(sale, index, inventory) {
        const productId = normalizeText(sale.productId || sale.produtoId || sale.product_id || sale.idProduto || sale.itemId);
        const product = inventory.find(item => String(item.id) === String(productId)) ||
            inventory.find(item => normalizeText(item.name).toLowerCase() === normalizeText(sale.productName || sale.product || sale.produto || sale.title).toLowerCase());
        const quantity = Math.max(1, Math.floor(toNumber(sale.quantity ?? sale.quantidade ?? sale.qty, 1)));
        const total = Math.max(0, toNumber(sale.total ?? sale.value ?? sale.amount ?? sale.valorTotal ?? sale.valor));
        const unitPrice = total > 0 ? total / quantity : toNumber(sale.unitPrice ?? sale.precoUnitario ?? product?.price);
        const resolvedTotal = total || Math.max(0, unitPrice * quantity);
        const createdAt = parseDate(sale.createdAt || sale.dateISO || sale.dataISO || sale.date || sale.data) || new Date();
        const paymentMethod = normalizePaymentMethod(sale.paymentMethod || sale.formaPagamento || sale.pagamento || sale.paymentType);
        const installments = paymentMethod === 'credito' ? Math.max(1, Math.floor(toNumber(sale.installments || sale.parcelas, 1))) : 1;
        const cardFeeRate = Math.max(0, toNumber(sale.cardFeeRate ?? sale.taxaMaquininha ?? sale.feeRate, defaultCardRate(paymentMethod, installments)));
        const cardFeeAmount = Math.max(0, toNumber(sale.cardFeeAmount ?? sale.taxaValor ?? sale.feeAmount, calculatePaymentFee(resolvedTotal, cardFeeRate)));
        const netTotal = Math.max(0, toNumber(sale.netTotal ?? sale.valorLiquido ?? sale.netAmount, resolvedTotal - cardFeeAmount));

        return {
            id: normalizeText(sale.id || sale.codigo || `s-${Date.now()}-${index}`),
            client: normalizeText(sale.client || sale.cliente || sale.customer || 'Cliente sem nome'),
            productId: product ? String(product.id) : productId,
            productName: normalizeText(sale.productName || sale.product || sale.produto || product?.name || 'Produto removido'),
            quantity,
            unitPrice: Math.max(0, unitPrice),
            total: resolvedTotal,
            value: resolvedTotal,
            costAtSale: toNumber(sale.costAtSale ?? sale.custoUnitario ?? product?.cost),
            nfeStatus: normalizeText(sale.nfeStatus || sale.statusNfe || sale.status || 'Pendente'),
            paymentStatus: normalizeText(sale.paymentStatus || sale.statusPagamento || 'A receber'),
            paymentMethod,
            installments,
            cardFeeRate,
            cardFeeAmount,
            netTotal,
            createdAt: createdAt.toISOString(),
            date: createdAt.toLocaleDateString('pt-BR')
        };
    }

    function stableId(prefix, parts) {
        return `${prefix}-${parts.map(part => normalizeText(part).toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-')}`.replace(/-+/g, '-').replace(/-$/, '');
    }

    function normalizeReceivable(item, index) {
        const client = normalizeText(item.client || item.cliente || 'Cliente');
        const dueDate = normalizeText(item.dueDate || item.vencimento || nextDateISO(7));
        const amount = Math.max(0, toNumber(item.amount ?? item.valor));
        return {
            id: normalizeText(item.id || stableId('rec', [client, dueDate, amount, index])),
            client,
            dueDate,
            amount,
            status: normalizeText(item.status || 'Pendente')
        };
    }

    function normalizePayable(item, index) {
        const supplier = normalizeText(item.supplier || item.fornecedor || 'Fornecedor');
        const dueDate = normalizeText(item.dueDate || item.vencimento || nextDateISO(7));
        const amount = Math.max(0, toNumber(item.amount ?? item.valor));
        return {
            id: normalizeText(item.id || stableId('pay', [supplier, dueDate, amount, index])),
            supplier,
            dueDate,
            amount,
            status: normalizeText(item.status || 'Pendente')
        };
    }

    function parseDate(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        const raw = String(value).trim();

        const iso = new Date(raw);
        if (!Number.isNaN(iso.getTime())) return iso;

        const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (slash) {
            const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
            const parsed = new Date(Number(year), Number(slash[2]) - 1, Number(slash[1]));
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const shortMonth = raw.match(/^(\d{1,2})\s+([a-zA-ZçÇ.]+)\s+(\d{4})$/);
        if (shortMonth) {
            const months = {
                jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
                jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
            };
            const month = months[shortMonth[2].slice(0, 3).toLowerCase().replace('.', '')];
            if (month !== undefined) {
                return new Date(Number(shortMonth[3]), month, Number(shortMonth[1]));
            }
        }

        return null;
    }

    function getData() {
        const stored = readJSON(STORAGE_KEY, null);
        const data = stored ? {
            inventory: Array.isArray(stored.inventory) ? stored.inventory : [],
            categories: Array.isArray(stored.categories) ? stored.categories : [],
            sales: Array.isArray(stored.sales) ? stored.sales : [],
            finance: stored.finance || {},
            settings: stored.settings || {}
        } : clone(defaultData);

        const legacyInventory = [
            ...asArray(readJSON('inventory', [])),
            ...asArray(readJSON('proledger_inventory', [])),
            ...asArray(readJSON('proledger_products', [])),
            ...asArray(readJSON('produtos', []))
        ];
        const legacySales = [
            ...asArray(readJSON('sales', [])),
            ...asArray(readJSON('proledger_sales', [])),
            ...asArray(readJSON('vendas', []))
        ];

        if (!stored && legacyInventory.length) {
            data.inventory = legacyInventory;
        }

        if (!stored && legacySales.length) {
            data.sales = legacySales;
        }

        data.inventory = dedupeById(data.inventory.map(normalizeProduct));
        data.categories = normalizeCategories(data.categories, data.inventory);
        data.sales = dedupeById(data.sales.map((sale, index) => normalizeSale(sale, index, data.inventory)));
        data.finance = {
            receivables: [
                ...asArray(data.finance.receivables).map(normalizeReceivable),
                ...asArray(readJSON('contas_receber', [])).map(normalizeReceivable)
            ],
            payables: [
                ...asArray(data.finance.payables).map(normalizePayable),
                ...asArray(readJSON('contas_pagar', [])).map(normalizePayable)
            ]
        };
        data.finance.receivables = dedupeById(data.finance.receivables);
        data.finance.payables = dedupeById(data.finance.payables);
        data.settings = normalizeSettings(data.settings);

        writeData(data);
        mirrorLegacyKeys(data);
        return data;
    }

    function setData(updater) {
        const current = getData();
        const next = typeof updater === 'function' ? updater(current) : updater;
        next.inventory = dedupeById(asArray(next.inventory).map(normalizeProduct));
        next.categories = normalizeCategories(next.categories, next.inventory);
        next.sales = dedupeById(asArray(next.sales).map((sale, index) => normalizeSale(sale, index, next.inventory)));
        next.finance = next.finance || {};
        next.finance.receivables = dedupeById(asArray(next.finance.receivables).map(normalizeReceivable));
        next.finance.payables = dedupeById(asArray(next.finance.payables).map(normalizePayable));
        next.settings = normalizeSettings(next.settings);
        writeData(next);
        mirrorLegacyKeys(next);
        window.dispatchEvent(new CustomEvent('proledger:data-change', { detail: next }));
        return next;
    }

    function mirrorLegacyKeys(data) {
        const oldInventory = data.inventory.map(item => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            category: item.category,
            qty: item.qty,
            stock: item.qty,
            cost: item.cost,
            price: item.price,
            icon: item.icon
        }));
        const oldSales = data.sales.map(sale => ({
            id: sale.id,
            date: sale.date,
            createdAt: sale.createdAt,
            client: sale.client,
            productId: sale.productId,
            productName: sale.productName,
            quantity: sale.quantity,
            value: sale.total,
            total: sale.total,
            nfeStatus: sale.nfeStatus,
            paymentStatus: sale.paymentStatus,
            paymentMethod: sale.paymentMethod,
            installments: sale.installments,
            cardFeeRate: sale.cardFeeRate,
            cardFeeAmount: sale.cardFeeAmount,
            netTotal: sale.netTotal,
            costAtSale: sale.costAtSale
        }));
        localStorage.setItem('inventory', JSON.stringify(oldInventory));
        localStorage.setItem('sales', JSON.stringify(oldSales));
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function dedupeById(items) {
        const seen = new Set();
        return items.filter(item => {
            const id = String(item.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value));
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return '';
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    function isSameDay(a, b) {
        return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    }

    function saleProfit(sale) {
        return toNumber(sale.netTotal ?? sale.total) - (toNumber(sale.costAtSale) * toNumber(sale.quantity, 1));
    }

    function setSettings(settings) {
        setData(current => {
            current.settings = normalizeSettings({ ...getSettings(current), ...settings });
            return current;
        });
    }

    function showToast(message) {
        let toast = document.getElementById('proledger-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'proledger-toast';
            toast.className = 'fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg bg-primary-container text-on-primary px-md py-sm shadow-lg text-body-sm font-body-sm transition-all duration-200 opacity-0 translate-y-2';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.remove('opacity-0', 'translate-y-2');
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
        }, 2600);
    }

    function ensureSettingsModal() {
        let modal = document.getElementById('settings-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'hidden fixed inset-0 z-[75] bg-[#00000080] items-center justify-center p-md';
        modal.innerHTML = `
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div class="flex items-center justify-between p-md border-b border-outline-variant">
                    <div class="flex items-center gap-sm">
                        <span class="material-symbols-outlined text-primary">settings</span>
                        <h2 class="text-title-sm font-headline-md text-on-surface m-0">Configuracoes</h2>
                    </div>
                    <button class="text-on-surface-variant hover:text-error transition-colors flex items-center justify-center rounded-full hover:bg-surface-container-low p-xs" type="button" data-close-settings aria-label="Fechar configuracoes">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form class="p-md flex flex-col gap-md" id="settings-form">
                    <div>
                        <label class="block text-label-caps font-label-caps text-on-surface-variant mb-xs" for="settings-low-stock-limit">Limite de estoque baixo</label>
                        <div class="flex items-center gap-sm">
                            <button class="material-symbols-outlined border border-outline-variant text-secondary p-xs rounded-lg hover:bg-surface-container-low transition-colors" type="button" data-step-settings="-1" title="Diminuir limite">remove</button>
                            <input class="w-28 bg-surface border border-outline-variant text-on-surface text-body-sm rounded-lg px-sm py-xs text-center focus:border-primary-container focus:ring-1 focus:ring-primary-container shadow-sm" id="settings-low-stock-limit" min="0" type="number" required />
                            <button class="material-symbols-outlined border border-outline-variant text-secondary p-xs rounded-lg hover:bg-surface-container-low transition-colors" type="button" data-step-settings="1" title="Aumentar limite">add</button>
                            <span class="text-body-sm text-on-surface-variant">unidades</span>
                        </div>
                    </div>
                    <div class="flex justify-end gap-sm pt-md border-t border-outline-variant">
                        <button class="px-md py-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors font-body-md font-semibold" type="button" data-close-settings>Cancelar</button>
                        <button class="bg-primary-container text-on-primary px-md py-sm rounded-lg hover:opacity-90 transition-opacity font-body-md font-semibold shadow-sm" type="submit">Salvar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#settings-form');
        const limitInput = modal.querySelector('#settings-low-stock-limit');

        modal.querySelectorAll('[data-close-settings]').forEach(button => {
            button.addEventListener('click', closeSettingsModal);
        });

        modal.querySelectorAll('[data-step-settings]').forEach(button => {
            button.addEventListener('click', () => {
                const delta = toNumber(button.dataset.stepSettings);
                limitInput.value = Math.max(0, Math.floor(toNumber(limitInput.value) + delta));
            });
        });

        modal.addEventListener('click', event => {
            if (event.target === modal) closeSettingsModal();
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            setSettings({ lowStockLimit: limitInput.value });
            closeSettingsModal();
            showToast('Configuracoes salvas.');
        });

        return modal;
    }

    function openSettingsModal() {
        const modal = ensureSettingsModal();
        const settings = getSettings();
        const limitInput = modal.querySelector('#settings-low-stock-limit');
        if (limitInput) limitInput.value = settings.lowStockLimit;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => limitInput?.focus(), 0);
    }

    function closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        modal?.classList.add('hidden');
        modal?.classList.remove('flex');
    }

    function downloadCSV(filename, rows) {
        const csv = rows.map(row => row.map(value => {
            const text = String(value ?? '');
            return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(';')).join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function statusBadgeClasses(status) {
        const normalized = normalizeText(status).toLowerCase();
        if (normalized.includes('emitida') || normalized.includes('recebido') || normalized.includes('pago')) {
            return 'bg-[#d1fae5] text-[#065f46]';
        }
        if (normalized.includes('atras')) return 'bg-error-container text-on-error-container';
        return 'bg-surface-container-high text-on-surface-variant';
    }

    function getStockStatus(product, settings = getSettings()) {
        if (product.qty <= 0) return { text: 'Esgotado', className: 'bg-error-container text-on-error-container', key: 'out_of_stock' };
        if (product.qty <= settings.lowStockLimit) return { text: 'Estoque baixo', className: 'bg-[#fff3e0] text-[#e65100]', key: 'low_stock' };
        return { text: 'Em estoque', className: 'bg-surface-variant text-on-surface', key: 'in_stock' };
    }

    function fixMojibake() {
        const replace = value => {
            let next = value;
            Object.entries(mojibakeMap).forEach(([bad, good]) => {
                next = next.split(bad).join(good);
            });
            return next;
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                return node.nodeValue.includes('Ã') || node.nodeValue.includes('Â')
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        });

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            node.nodeValue = replace(node.nodeValue);
        });

        document.querySelectorAll('[placeholder], [title], [alt], option').forEach(element => {
            ['placeholder', 'title', 'alt'].forEach(attr => {
                if (element.hasAttribute(attr)) element.setAttribute(attr, replace(element.getAttribute(attr)));
            });
            if (element.tagName === 'OPTION') element.textContent = replace(element.textContent);
        });
    }

    function bindCommonUI() {
        document.addEventListener('click', event => {
            const settingsLink = event.target.closest('[data-open-settings], a[href="#settings"]');
            if (!settingsLink) return;
            event.preventDefault();
            settingsLink.closest('#proledger-mobile-drawer')?.classList.add('hidden');
            openSettingsModal();
        });

        document.querySelectorAll('a[href="#"]').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                showToast('Esta area esta pronta para receber a proxima etapa do sistema.');
            });
        });

        document.querySelectorAll('button').forEach(button => {
            const icon = button.textContent.trim();
            if (icon === 'notifications') {
                button.addEventListener('click', () => showToast('Sem novas notificacoes por enquanto.'));
            }
            // account_circle é gerenciado pelo auth.js (dropdown de perfil)
            if (icon === 'more_horiz') {
                button.addEventListener('click', () => showToast('Grafico atualizado com as vendas salvas.'));
            }
        });

        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.trim() === 'menu') {
                button.addEventListener('click', openMobileMenu);
            }
        });
    }

    function getCurrentPageKey() {
        const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (file.includes('estoque')) return 'estoque';
        if (file.includes('vendas')) return 'vendas';
        if (file.includes('financeiro')) return 'financeiro';
        return 'dashboard';
    }

    function standardizeAppShell() {
        const page = getCurrentPageKey();
        const pageMeta = {
            dashboard: { label: 'Pagina Inicial', icon: 'home', search: 'Buscar na pagina inicial...' },
            estoque: { label: 'Estoque', icon: 'inventory_2', search: 'Buscar produtos, SKUs...' },
            vendas: { label: 'Vendas / NF-e', icon: 'receipt_long', search: 'Buscar vendas...' },
            financeiro: { label: 'Relatorios', icon: 'analytics', search: 'Buscar no financeiro...' }
        };

        const sidebars = Array.from(document.querySelectorAll('aside, nav')).filter(element => {
            const text = element.textContent || '';
            const classes = element.className || '';
            return (text.includes('Dashboard') || text.includes('Pagina Inicial')) &&
                (text.includes('Inventory') || text.includes('Estoque')) &&
                !classes.includes('md:hidden') &&
                !classes.includes('fixed bottom-0');
        });

        sidebars.forEach(sidebar => {
            sidebar.className = 'hidden md:flex flex-col h-full p-md gap-base docked left-0 w-64 shrink-0 bg-surface-container-low border-r border-outline-variant z-30';
            sidebar.innerHTML = buildSidebarHTML(page);
        });

        document.querySelectorAll('header').forEach(header => {
            header.className = 'flex justify-between items-center w-full px-lg py-sm sticky top-0 z-40 bg-surface text-primary border-b border-outline-variant shrink-0';
            header.innerHTML = buildTopbarHTML(pageMeta[page]);
        });
    }

    function buildSidebarHTML(activePage) {
        const links = [
            { key: 'dashboard', href: 'index.html', icon: 'home', label: 'Pagina Inicial' },
            { key: 'estoque', href: 'estoque.html', icon: 'inventory_2', label: 'Estoque' },
            { key: 'vendas', href: 'vendas.html', icon: 'receipt_long', label: 'Vendas / NF-e' },
            { key: 'financeiro', href: 'financeiro.html', icon: 'analytics', label: 'Relatorios' }
        ];

        return `
            <div class="flex items-center mb-lg px-xs"><img alt="Logo Informais Sistemas" class="h-14 w-auto max-w-[180px] object-contain" src="logotipo-informais.jpg.jpeg"/></div>
            <nav class="flex-1 flex flex-col gap-xs overflow-y-auto">
                ${links.map(link => {
                    const active = link.key === activePage;
                    return `
                        <a class="flex items-center gap-sm p-sm rounded-lg transition-colors ${active ? 'bg-secondary-container text-on-secondary-container font-semibold scale-95' : 'text-secondary hover:bg-surface-container-highest'}" href="${link.href}">
                            <span class="material-symbols-outlined" style="${active ? "font-variation-settings: 'FILL' 1;" : ''}">${link.icon}</span>
                            <span class="font-label-caps text-label-caps">${link.label}</span>
                        </a>
                    `;
                }).join('')}
            </nav>
            <div class="flex flex-col gap-xs mt-auto border-t border-outline-variant pt-md">
                <a class="flex items-center gap-sm p-sm rounded-lg text-secondary hover:bg-surface-container-highest transition-colors" href="#settings" data-open-settings>
                    <span class="material-symbols-outlined">settings</span>
                    <span class="font-label-caps text-label-caps">Configuracoes</span>
                </a>
                <a class="flex items-center gap-sm p-sm rounded-lg text-secondary hover:bg-surface-container-highest transition-colors" href="#">
                    <span class="material-symbols-outlined">help_outline</span>
                    <span class="font-label-caps text-label-caps">Ajuda</span>
                </a>
            </div>
        `;
    }

    function buildTopbarHTML(meta) {
        return `
            <div class="flex items-center gap-md flex-1 min-w-0">
                <button class="md:hidden text-on-surface-variant hover:text-primary transition-colors p-xs rounded-full" type="button" aria-label="Abrir menu">
                    <span class="material-symbols-outlined">menu</span>
                </button>
                <div class="hidden sm:flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-xs w-full max-w-sm focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container transition-shadow">
                    <span class="material-symbols-outlined text-outline text-[20px]">search</span>
                    <input class="w-full bg-transparent border-none text-body-sm font-body-sm text-on-surface focus:ring-0 placeholder:text-outline ml-xs py-1" placeholder="${meta.search}" type="text"/>
                </div>
            </div>
            <div class="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-xs text-primary">
                <span class="material-symbols-outlined text-[20px]">${meta.icon}</span>
                <span class="text-title-sm font-headline-md font-bold whitespace-nowrap">${meta.label}</span>
            </div>
            <div class="flex items-center gap-sm">
                <button class="p-xs text-on-surface-variant hover:bg-surface-container-low hover:text-primary rounded-full transition-colors flex items-center justify-center" type="button" aria-label="Notificacoes">
                    <span class="material-symbols-outlined">notifications</span>
                </button>
                <button class="p-xs text-on-surface-variant hover:bg-surface-container-low hover:text-primary rounded-full transition-colors flex items-center justify-center" type="button" aria-label="Perfil">
                    <span class="material-symbols-outlined">account_circle</span>
                </button>
            </div>
        `;
    }

    function openMobileMenu() {
        let drawer = document.getElementById('proledger-mobile-drawer');
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = 'proledger-mobile-drawer';
            drawer.className = 'fixed inset-0 z-[70] hidden';
            drawer.innerHTML = `
                <div class="absolute inset-0 bg-black/40" data-close-menu></div>
                <div class="absolute left-0 top-0 bottom-0 w-72 bg-surface-container-low border-r border-outline-variant p-md flex flex-col gap-sm shadow-xl">
                    <div class="flex items-center justify-between mb-md">
                        <div class="flex items-center gap-sm min-w-0"><img alt="Logo Informais Sistemas" class="h-8 w-8 rounded-lg object-cover" src="logotipo-informais.jpg.jpeg"/><strong class="text-title-sm text-primary truncate">informais</strong></div>
                        <button class="material-symbols-outlined text-secondary" data-close-menu>close</button>
                    </div>
                    <a class="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-high" href="index.html"><span class="material-symbols-outlined">home</span>Pagina Inicial</a>
                    <a class="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-high" href="estoque.html"><span class="material-symbols-outlined">inventory_2</span>Estoque</a>
                    <a class="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-high" href="vendas.html"><span class="material-symbols-outlined">receipt_long</span>Vendas</a>
                    <a class="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-high" href="financeiro.html"><span class="material-symbols-outlined">analytics</span>Relatorios</a>
                    <a class="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-high" href="#settings" data-open-settings><span class="material-symbols-outlined">settings</span>Configuracoes</a>
                </div>
            `;
            document.body.appendChild(drawer);
            drawer.addEventListener('click', event => {
                if (event.target.closest('[data-close-menu]')) drawer.classList.add('hidden');
            });
        }
        drawer.classList.remove('hidden');
    }

    function initDashboardPage() {
        if (!document.getElementById('metric-sales-today')) return;

        const searchInput = document.querySelector('input[placeholder*="pagina inicial"]');
        let dashboardQuery = '';
        let dashboardSearchItems = [];
        let dashboardEmptyState = null;

        function setupDashboardSearch() {
            const main = document.querySelector('main');
            if (!main || !searchInput) return;

            const metricCards = [
                document.getElementById('metric-sales-today')?.closest('.rounded-lg'),
                document.getElementById('metric-monthly-revenue')?.closest('.rounded-lg'),
                document.getElementById('metric-profit')?.closest('.rounded-lg'),
                document.getElementById('metric-alerts')?.closest('.rounded-lg')
            ].filter(Boolean);

            const chartSection = document.getElementById('sales-chart-container')?.closest('section');
            const activitySection = document.getElementById('recent-activity-list')?.closest('section');
            dashboardSearchItems = [...metricCards, chartSection, activitySection].filter(Boolean);

            if (!dashboardEmptyState) {
                dashboardEmptyState = document.createElement('p');
                dashboardEmptyState.className = 'hidden text-body-md text-secondary text-center bg-surface-container-lowest border border-outline-variant rounded-lg p-lg';
                dashboardEmptyState.textContent = 'Nenhum resultado encontrado na pagina inicial.';
                main.querySelector('.max-w-container-max')?.appendChild(dashboardEmptyState);
            }

            searchInput.addEventListener('input', event => {
                dashboardQuery = event.target.value.trim().toLowerCase();
                applyDashboardSearch();
            });
        }

        function applyDashboardSearch() {
            if (!dashboardSearchItems.length) return;

            let visibleCount = 0;
            dashboardSearchItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                const isVisible = !dashboardQuery || text.includes(dashboardQuery);
                item.classList.toggle('hidden', !isVisible);
                if (isVisible) visibleCount += 1;
            });

            dashboardEmptyState?.classList.toggle('hidden', !dashboardQuery || visibleCount > 0);
        }

        function renderDashboard() {
            const data = getData();
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const last7Days = [];

            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                last7Days.push({
                    date,
                    label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
                    total: 0
                });
            }

            const metrics = data.sales.reduce((acc, sale) => {
                const date = parseDate(sale.createdAt);
                if (!date) return acc;

                if (isSameDay(date, today)) acc.today += sale.total;
                if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                    acc.month += sale.total;
                    acc.profit += saleProfit(sale);
                }

                const chartDay = last7Days.find(day => isSameDay(day.date, date));
                if (chartDay) chartDay.total += sale.total;
                return acc;
            }, { today: 0, month: 0, profit: 0 });

            setText('metric-sales-today', formatCurrency(metrics.today));
            setText('metric-monthly-revenue', formatCurrency(metrics.month));
            setText('metric-profit', formatCurrency(metrics.profit));
            const settings = getSettings(data);
            const lowStock = data.inventory.filter(item => item.qty <= settings.lowStockLimit).length;
            const alerts = document.getElementById('metric-alerts');
            if (alerts) alerts.innerHTML = `${lowStock} <span class="text-title-sm text-secondary">itens</span>`;
            const alertsLabel = alerts?.closest('.rounded-lg')?.querySelector('.text-outline');
            if (alertsLabel) alertsLabel.textContent = `Ate ${settings.lowStockLimit} un.`;

            renderDashboardChart(last7Days);
            renderRecentActivity(data.sales);
            applyDashboardSearch();
        }

        setupDashboardSearch();
        renderDashboard();
        window.addEventListener('proledger:data-change', renderDashboard);
        window.addEventListener('storage', event => {
            if (event.key === STORAGE_KEY) renderDashboard();
        });
    }

    function renderDashboardChart(days) {
        const chartContainer = document.getElementById('sales-chart-container');
        if (!chartContainer) return;

        const maxTotal = Math.max(...days.map(day => day.total), 1);
        chartContainer.innerHTML = `
            <div class="absolute w-full border-t border-outline-variant/30 top-0"></div>
            <div class="absolute w-full border-t border-outline-variant/30 top-1/3"></div>
            <div class="absolute w-full border-t border-outline-variant/30 top-2/3"></div>
            ${days.map((day, index) => {
                const height = Math.max(6, (day.total / maxTotal) * 100);
                const isToday = index === days.length - 1;
                return `
                    <div class="flex flex-col items-center gap-sm z-10 flex-1 group relative h-full justify-end">
                        <div class="absolute -top-8 bg-inverse-surface text-inverse-on-surface text-label-caps px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            ${formatCurrency(day.total)}
                        </div>
                        <div class="w-full max-w-[32px] ${isToday ? 'bg-primary-container' : 'bg-primary-fixed-dim hover:bg-primary-container'} rounded-t transition-all duration-500" style="height: ${height}%"></div>
                        <span class="text-label-caps font-label-caps ${isToday ? 'text-primary font-bold' : 'text-secondary'} capitalize">${day.label}</span>
                    </div>
                `;
            }).join('')}
        `;

        const yLabels = document.getElementById('y-axis-labels');
        if (yLabels) {
            yLabels.innerHTML = `
                <span>${formatCurrency(maxTotal)}</span>
                <span>${formatCurrency(maxTotal * 0.66)}</span>
                <span>${formatCurrency(maxTotal * 0.33)}</span>
                <span>R$ 0,00</span>
            `;
        }
    }

    function renderRecentActivity(sales) {
        const activityList = document.getElementById('recent-activity-list');
        if (!activityList) return;

        const recent = [...sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        if (!recent.length) {
            activityList.innerHTML = '<li class="p-sm text-center text-outline text-body-sm">Nenhuma atividade recente.</li>';
            return;
        }

        activityList.innerHTML = recent.map(sale => `
            <li class="flex items-center justify-between p-sm hover:bg-surface-container-low rounded transition-colors border border-transparent hover:border-outline-variant/50">
                <div class="flex items-center gap-sm min-w-0">
                    <div class="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                        <span class="material-symbols-outlined">shopping_bag</span>
                    </div>
                    <div class="min-w-0">
                        <p class="text-data-tabular font-data-tabular text-on-surface truncate max-w-[180px]" title="${escapeHTML(sale.productName)}">${escapeHTML(sale.productName)}</p>
                        <p class="text-label-caps font-label-caps text-outline truncate max-w-[180px]" title="${escapeHTML(sale.client)}">${escapeHTML(sale.client)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-data-tabular font-data-tabular text-on-surface">${formatCurrency(sale.total)}</p>
                    <span class="inline-block px-[12px] py-[4px] rounded text-label-caps font-label-caps ${statusBadgeClasses(sale.nfeStatus)}">${escapeHTML(sale.nfeStatus)}</span>
                </div>
            </li>
        `).join('');
    }

    function initSalesPage() {
        const tableBody = document.getElementById('sales-table-body');
        const productSelect = document.getElementById('sale-product');
        const form = document.getElementById('new-sale-form');
        if (!tableBody || !productSelect || !form) return;

        const searchInput = document.querySelector('input[placeholder*="Buscar"]');
        const saleModal = document.getElementById('sale-form-modal');
        const quantityInput = document.getElementById('sale-quantity');
        const valueInput = document.getElementById('sale-value');
        const paymentMethodInput = document.getElementById('sale-payment-method');
        const installmentsInput = document.getElementById('sale-installments');
        const feeRateInput = document.getElementById('sale-fee-rate');
        const feeAmountPreview = document.getElementById('sale-fee-amount');
        const netTotalPreview = document.getElementById('sale-net-total');
        const exportButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Exportar'));
        let query = '';

        function renderOptions() {
            const data = getData();
            productSelect.innerHTML = '<option value="" disabled selected>Selecione um produto</option>';
            data.inventory.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.disabled = product.qty <= 0;
                option.dataset.price = product.price;
                option.dataset.stock = product.qty;
                option.textContent = `${product.name} (Estoque: ${product.qty}) - ${formatCurrency(product.price)}`;
                productSelect.appendChild(option);
            });
        }

        function calculateTotal() {
            const option = productSelect.selectedOptions[0];
            const qty = Math.max(1, toNumber(quantityInput.value, 1));
            const stock = toNumber(option?.dataset.stock);
            if (option?.dataset.price) {
                quantityInput.max = String(stock || '');
                valueInput.value = (toNumber(option.dataset.price) * qty).toFixed(2);
            } else {
                valueInput.value = '';
            }
            updatePaymentPreview();
        }

        function updatePaymentPreview(resetRate = false) {
            const method = normalizePaymentMethod(paymentMethodInput?.value);
            const installments = Math.max(1, Math.floor(toNumber(installmentsInput?.value, 1)));
            const isCredit = method === 'credito';
            if (installmentsInput) {
                installmentsInput.disabled = !isCredit;
                if (!isCredit) installmentsInput.value = '1';
            }
            if (feeRateInput && resetRate) {
                feeRateInput.value = defaultCardRate(method, isCredit ? installments : 1).toFixed(2);
            }

            const total = toNumber(valueInput.value);
            const rate = toNumber(feeRateInput?.value, defaultCardRate(method, installments));
            const fee = calculatePaymentFee(total, rate);
            const net = Math.max(0, total - fee);

            if (feeAmountPreview) feeAmountPreview.textContent = formatCurrency(fee);
            if (netTotalPreview) netTotalPreview.textContent = formatCurrency(net);
        }

        function openSaleModal() {
            renderOptions();
            saleModal?.classList.remove('hidden');
            saleModal?.classList.add('flex');
            setTimeout(() => document.getElementById('sale-client')?.focus(), 0);
        }

        function closeSaleModal() {
            saleModal?.classList.add('hidden');
            saleModal?.classList.remove('flex');
            form.reset();
            valueInput.value = '';
            if (paymentMethodInput) paymentMethodInput.value = 'pix';
            if (installmentsInput) installmentsInput.value = '1';
            if (feeRateInput) feeRateInput.value = '0.00';
            updatePaymentPreview();
        }

        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.includes('Nova Venda')) {
                button.addEventListener('click', event => {
                    event.preventDefault();
                    openSaleModal();
                });
            }
            if (button.textContent.trim() === 'close' || button.textContent.includes('Cancelar')) {
                if (button.closest('#sale-form-modal')) {
                    button.addEventListener('click', event => {
                        event.preventDefault();
                        closeSaleModal();
                    });
                }
            }
        });

        saleModal?.addEventListener('click', event => {
            if (event.target === saleModal) closeSaleModal();
        });

        productSelect.addEventListener('change', calculateTotal);
        quantityInput.addEventListener('input', calculateTotal);
        valueInput.addEventListener('input', () => updatePaymentPreview());
        paymentMethodInput?.addEventListener('change', () => updatePaymentPreview(true));
        installmentsInput?.addEventListener('change', () => updatePaymentPreview(true));
        feeRateInput?.addEventListener('input', () => updatePaymentPreview());

        form.addEventListener('submit', event => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const client = document.getElementById('sale-client').value.trim();
            const productId = productSelect.value;
            const quantity = Math.max(1, Math.floor(toNumber(quantityInput.value, 1)));
            const paymentMethod = normalizePaymentMethod(paymentMethodInput?.value);
            const installments = paymentMethod === 'credito' ? Math.max(1, Math.floor(toNumber(installmentsInput?.value, 1))) : 1;

            const data = getData();
            const product = data.inventory.find(item => String(item.id) === String(productId));
            if (!product) {
                showToast('Selecione um produto valido.');
                return;
            }
            if (quantity > product.qty) {
                showToast(`Estoque insuficiente. Disponivel: ${product.qty}.`);
                return;
            }

            const total = toNumber(valueInput.value, product.price * quantity);
            const cardFeeRate = Math.max(0, toNumber(feeRateInput?.value, defaultCardRate(paymentMethod, installments)));
            const cardFeeAmount = calculatePaymentFee(total, cardFeeRate);
            const netTotal = Math.max(0, total - cardFeeAmount);
            setData(current => {
                const currentProduct = current.inventory.find(item => String(item.id) === String(productId));
                currentProduct.qty = Math.max(0, currentProduct.qty - quantity);
                current.sales.unshift({
                    id: `s-${Date.now()}`,
                    client,
                    productId: currentProduct.id,
                    productName: currentProduct.name,
                    quantity,
                    unitPrice: total / quantity,
                    total,
                    value: total,
                    costAtSale: currentProduct.cost,
                    nfeStatus: 'Pendente',
                    paymentStatus: 'A receber',
                    paymentMethod,
                    installments,
                    cardFeeRate,
                    cardFeeAmount,
                    netTotal,
                    createdAt: new Date().toISOString(),
                    date: new Date().toLocaleDateString('pt-BR')
                });
                return current;
            });

            closeSaleModal();
            renderOptions();
            renderSales();
            showToast('Venda registrada e estoque atualizado.');
        }, true);

        searchInput?.addEventListener('input', event => {
            query = event.target.value.toLowerCase();
            renderSales();
        });

        exportButton?.addEventListener('click', event => {
            event.preventDefault();
            const data = getData();
            downloadCSV('vendas-proledger.csv', [
                ['Data', 'Cliente', 'Produto', 'Quantidade', 'Valor bruto', 'Forma de pagamento', 'Taxa maquininha', 'Valor liquido', 'NF-e', 'Pagamento'],
                ...data.sales.map(sale => [formatDate(sale.createdAt), sale.client, sale.productName, sale.quantity, sale.total, paymentLabel(sale.paymentMethod, sale.installments), sale.cardFeeAmount, sale.netTotal, sale.nfeStatus, sale.paymentStatus])
            ]);
            showToast('Relatorio de vendas exportado.');
        });

        window.emitNfe = function (saleId) {
            setData(current => {
                const sale = current.sales.find(item => String(item.id) === String(saleId));
                if (sale) sale.nfeStatus = 'Emitida';
                return current;
            });
            renderSales();
            showToast('NF-e marcada como emitida.');
        };

        window.markSalePaid = function (saleId) {
            setData(current => {
                const sale = current.sales.find(item => String(item.id) === String(saleId));
                if (sale) sale.paymentStatus = 'Recebido';
                return current;
            });
            renderSales();
            showToast('Recebimento confirmado.');
        };

        window.deleteSale = function (saleId) {
            if (!confirm('Remover esta venda e devolver os itens ao estoque?')) return;
            setData(current => {
                const sale = current.sales.find(item => String(item.id) === String(saleId));
                if (sale) {
                    const product = current.inventory.find(item => String(item.id) === String(sale.productId));
                    if (product) product.qty += sale.quantity;
                }
                current.sales = current.sales.filter(item => String(item.id) !== String(saleId));
                return current;
            });
            renderOptions();
            renderSales();
            showToast('Venda removida e estoque devolvido.');
        };

        function renderSales() {
            const data = getData();
            const visibleSales = data.sales.filter(sale => {
                const haystack = `${sale.client} ${sale.productName} ${sale.nfeStatus} ${sale.paymentStatus} ${paymentLabel(sale.paymentMethod, sale.installments)} ${sale.id}`.toLowerCase();
                return !query || haystack.includes(query);
            });
            const empty = document.getElementById('empty-state');

            if (!visibleSales.length) {
                tableBody.innerHTML = '';
                empty?.classList.remove('hidden');
            } else {
                empty?.classList.add('hidden');
                tableBody.innerHTML = visibleSales.map(sale => {
                    const actionButtons = [];
                    const feeAmount = toNumber(sale.cardFeeAmount);
                    const netTotal = toNumber(sale.netTotal ?? sale.total);
                    if (sale.nfeStatus !== 'Emitida') {
                        actionButtons.push(`<button onclick="emitNfe('${escapeHTML(sale.id)}')" class="px-sm py-xs border border-primary text-primary rounded bg-surface hover:bg-surface-container-low transition-colors text-label-caps font-label-caps">Gerar NF-e</button>`);
                    }
                    if (sale.paymentStatus !== 'Recebido') {
                        actionButtons.push(`<button onclick="markSalePaid('${escapeHTML(sale.id)}')" class="px-sm py-xs border border-outline-variant text-secondary rounded bg-surface hover:bg-surface-container-low transition-colors text-label-caps font-label-caps">Receber</button>`);
                    }
                    actionButtons.push(`<button onclick="deleteSale('${escapeHTML(sale.id)}')" class="material-symbols-outlined text-on-surface-variant hover:text-error p-xs align-middle" title="Remover venda">delete</button>`);

                    return `
                        <tr class="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                            <td class="px-md py-sm whitespace-nowrap">${formatDate(sale.createdAt)}</td>
                            <td class="px-md py-sm">${escapeHTML(sale.client)}<br><span class="text-body-sm text-secondary">Ref: #${escapeHTML(String(sale.id).slice(-4))}</span></td>
                            <td class="px-md py-sm">${escapeHTML(sale.productName)}</td>
                            <td class="px-md py-sm">${sale.quantity}</td>
                            <td class="px-md py-sm whitespace-nowrap">${formatCurrency(sale.total)}<br><span class="text-[10px] text-secondary">Liquido: ${formatCurrency(netTotal)}</span></td>
                            <td class="px-md py-sm whitespace-nowrap">${escapeHTML(paymentLabel(sale.paymentMethod, sale.installments))}<br><span class="text-[10px] text-secondary">Taxa: ${formatCurrency(feeAmount)} (${toNumber(sale.cardFeeRate).toFixed(2)}%)</span></td>
                            <td class="px-md py-sm">
                                <span class="px-sm py-xs ${statusBadgeClasses(sale.nfeStatus)} rounded-full text-[10px] font-bold uppercase tracking-wider">${escapeHTML(sale.nfeStatus)}</span>
                                <span class="block mt-xs text-[10px] text-secondary">${escapeHTML(sale.paymentStatus)}</span>
                            </td>
                            <td class="px-md py-sm text-right">
                                <div class="flex items-center justify-end gap-xs flex-wrap">${actionButtons.join('')}</div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            const totals = data.sales.reduce((acc, sale) => {
                acc.total += sale.total;
                if (sale.nfeStatus === 'Emitida') acc.emitted += 1;
                else acc.pending += 1;
                return acc;
            }, { total: 0, pending: 0, emitted: 0 });

            setText('total-sales-value', formatCurrency(totals.total));
            setText('pending-nfe-count', totals.pending);
            setText('emitted-nfe-count', totals.emitted);
        }

        renderOptions();
        updatePaymentPreview(true);
        renderSales();
        window.addEventListener('proledger:data-change', renderSales);
    }

    function initInventoryPage() {
        const tableBody = document.getElementById('inventory-table-body');
        const form = document.getElementById('add-product-form');
        if (!tableBody || !form) return;

        const searchInput = document.querySelector('input[placeholder*="Buscar produtos"]');
        const selects = Array.from(document.querySelectorAll('main select'));
        const categorySelect = selects[0];
        const stockSelect = selects[1];
        const clearButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Limpar Filtros'));
        const modal = document.getElementById('add-product-form-container');
        const toggleBtn = document.getElementById('toggle-add-form-btn');
        const cancelBtn = document.getElementById('cancel-add-btn');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const productCategorySelect = document.getElementById('prod-category');
        const categoryManagerSelect = document.getElementById('category-manager-select');
        const categoryManagerName = document.getElementById('category-manager-name');
        const addCategoryButton = document.getElementById('add-category-btn');
        const renameCategoryButton = document.getElementById('rename-category-btn');
        const deleteCategoryButton = document.getElementById('delete-category-btn');
        const modalTitle = modal?.querySelector('h2');
        const submitButton = form.querySelector('button[type="submit"]');
        let filters = { search: '', category: '', stock: '' };
        let editingProductId = null;

        categorySelect?.removeAttribute('disabled');
        stockSelect?.removeAttribute('disabled');

        function openProductModal(product = null) {
            editingProductId = product ? String(product.id) : null;
            if (modalTitle) modalTitle.textContent = product ? 'Editar Produto' : 'Novo Produto';
            if (submitButton) submitButton.textContent = product ? 'Salvar Alteracoes' : 'Salvar Produto';

            if (product) {
                document.getElementById('prod-name').value = product.name;
                document.getElementById('prod-sku').value = product.sku;
                ensureCategoryOption(productCategorySelect, product.category);
                productCategorySelect.value = product.category;
                document.getElementById('prod-qty').value = product.qty;
                document.getElementById('prod-cost').value = product.cost;
                document.getElementById('prod-price').value = product.price;
            } else {
                form.reset();
            }

            modal?.classList.remove('hidden');
            modal?.classList.add('flex');
            setTimeout(() => document.getElementById('prod-name')?.focus(), 0);
        }

        function closeModal() {
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');
            form.reset();
            editingProductId = null;
            if (modalTitle) modalTitle.textContent = 'Novo Produto';
            if (submitButton) submitButton.textContent = 'Salvar Produto';
        }

        function ensureCategoryOption(select, value) {
            if (!select || !value) return;
            const exists = Array.from(select.options).some(option => option.value === value);
            if (!exists) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            }
        }

        function fillCategorySelect(select, categories, placeholder, selectedValue = '') {
            if (!select) return;
            select.innerHTML = `<option value="">${placeholder}</option>`;
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
            select.value = selectedValue;
        }

        function fillFilterCategorySelect(categories, selectedValue = '') {
            if (!categorySelect) return;
            fillCategorySelect(categorySelect, categories, 'Todas as Categorias', selectedValue);
            const createOption = document.createElement('option');
            createOption.value = '__create_category__';
            createOption.textContent = '+ Criar nova categoria';
            categorySelect.appendChild(createOption);
        }

        function renderCategoryControls() {
            const data = getData();
            const currentFilter = filters.category;
            const currentProductCategory = productCategorySelect?.value || '';
            const currentManagerCategory = categoryManagerSelect?.value || '';

            fillFilterCategorySelect(data.categories, currentFilter);
            fillCategorySelect(productCategorySelect, data.categories, 'Selecione...', currentProductCategory);
            fillCategorySelect(categoryManagerSelect, data.categories, 'Selecione uma categoria', currentManagerCategory);
        }

        function createCategoryFromName(name) {
            const normalizedName = normalizeText(name);
            if (!normalizedName) {
                alert('Informe o nome da categoria.');
                return false;
            }

            const data = getData();
            if (categoryExists(normalizedName, data.categories)) {
                alert('Erro: esta categoria ja existe.');
                return false;
            }

            setData(current => {
                current.categories = [...asArray(current.categories), normalizedName];
                return current;
            });
            return normalizedName;
        }

        function categoryExists(name, categories = getData().categories) {
            return categories.some(category => category.toLowerCase() === name.toLowerCase());
        }

        function normalizeFieldValue(id) {
            return normalizeText(document.getElementById(id)?.value);
        }

        function findDuplicateProduct(products, payload, ignoredId = null) {
            const nextName = payload.name.toLowerCase();
            const nextSku = payload.sku.toLowerCase();
            return products.find(product => {
                if (ignoredId && String(product.id) === String(ignoredId)) return false;
                return product.name.toLowerCase() === nextName || product.sku.toLowerCase() === nextSku;
            });
        }

        toggleBtn?.addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            openProductModal();
        }, true);

        [cancelBtn, closeModalBtn].forEach(button => {
            button?.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                closeModal();
            }, true);
        });

        modal?.addEventListener('click', event => {
            if (event.target === modal) closeModal();
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const isEditing = Boolean(editingProductId);
            const data = getData();

            const productPayload = {
                name: normalizeFieldValue('prod-name'),
                sku: normalizeFieldValue('prod-sku'),
                category: productCategorySelect?.value || '',
                qty: Math.max(0, Math.floor(toNumber(document.getElementById('prod-qty').value))),
                cost: Math.max(0, toNumber(document.getElementById('prod-cost').value)),
                price: Math.max(0, toNumber(document.getElementById('prod-price').value)),
                icon: 'inventory_2'
            };

            if (!productPayload.category || !categoryExists(productPayload.category, data.categories)) {
                alert('Erro: selecione uma categoria cadastrada para este produto.');
                return;
            }

            const duplicate = findDuplicateProduct(data.inventory, productPayload, editingProductId);
            if (duplicate) {
                alert(`Erro: este produto ja existe no estoque (${duplicate.name} / ${duplicate.sku}).`);
                return;
            }

            setData(current => {
                if (editingProductId) {
                    const product = current.inventory.find(item => String(item.id) === editingProductId);
                    if (product) {
                        Object.assign(product, productPayload, { icon: product.icon || productPayload.icon });
                    }
                } else {
                    current.inventory.unshift({
                        id: `p-${Date.now()}`,
                        ...productPayload
                    });
                }
                return current;
            });

            closeModal();
            renderCategoryControls();
            renderInventory();
            showToast(isEditing ? 'Produto atualizado.' : 'Produto salvo no estoque.');
        }, true);

        searchInput?.addEventListener('input', event => {
            filters.search = event.target.value.toLowerCase();
            renderInventory();
        });

        categorySelect?.addEventListener('change', event => {
            if (event.target.value === '__create_category__') {
                const created = createCategoryFromName(prompt('Digite o nome da nova categoria:'));
                filters.category = created || '';
                renderCategoryControls();
                renderInventory();
                if (created) showToast('Categoria adicionada.');
                return;
            }
            filters.category = event.target.value;
            renderInventory();
        });

        categoryManagerSelect?.addEventListener('change', event => {
            if (categoryManagerName) categoryManagerName.value = event.target.value;
        });

        addCategoryButton?.addEventListener('click', event => {
            event.preventDefault();
            const created = createCategoryFromName(categoryManagerName?.value);
            if (!created) return;
            if (categoryManagerName) categoryManagerName.value = '';
            renderCategoryControls();
            renderInventory();
            showToast('Categoria adicionada.');
        });

        renameCategoryButton?.addEventListener('click', event => {
            event.preventDefault();
            const oldName = categoryManagerSelect?.value || '';
            const newName = normalizeText(categoryManagerName?.value);
            if (!oldName) {
                alert('Selecione uma categoria para renomear.');
                return;
            }
            if (!newName) {
                alert('Informe o novo nome da categoria.');
                return;
            }

            const data = getData();
            if (oldName.toLowerCase() !== newName.toLowerCase() && categoryExists(newName, data.categories)) {
                alert('Erro: ja existe uma categoria com esse nome.');
                return;
            }

            setData(current => {
                current.categories = asArray(current.categories).map(category => category === oldName ? newName : category);
                current.inventory = current.inventory.map(product => product.category === oldName ? { ...product, category: newName } : product);
                return current;
            });
            filters.category = filters.category === oldName ? newName : filters.category;
            if (categoryManagerName) categoryManagerName.value = newName;
            renderCategoryControls();
            renderInventory();
            showToast('Categoria renomeada.');
        });

        deleteCategoryButton?.addEventListener('click', event => {
            event.preventDefault();
            const category = categoryManagerSelect?.value || '';
            if (!category) {
                alert('Selecione uma categoria para remover.');
                return;
            }

            const data = getData();
            const inUse = data.inventory.some(product => product.category === category);
            if (inUse) {
                alert('Erro: esta categoria esta sendo usada por produtos. Renomeie ou edite esses produtos antes de remover.');
                return;
            }
            if (!confirm(`Remover a categoria "${category}"?`)) return;

            setData(current => {
                current.categories = asArray(current.categories).filter(item => item !== category);
                return current;
            });
            filters.category = filters.category === category ? '' : filters.category;
            if (categoryManagerName) categoryManagerName.value = '';
            renderCategoryControls();
            renderInventory();
            showToast('Categoria removida.');
        });

        stockSelect?.addEventListener('change', event => {
            filters.stock = event.target.value;
            renderInventory();
        });

        clearButton?.addEventListener('click', event => {
            event.preventDefault();
            filters = { search: '', category: '', stock: '' };
            if (searchInput) searchInput.value = '';
            if (categorySelect) categorySelect.selectedIndex = 0;
            if (stockSelect) stockSelect.selectedIndex = 0;
            renderInventory();
        });

        window.adjustStock = function (productId, delta) {
            setData(current => {
                const product = current.inventory.find(item => String(item.id) === String(productId));
                if (product) product.qty = Math.max(0, product.qty + Number(delta));
                return current;
            });
            renderInventory();
        };

        window.deleteProduct = function (productId) {
            if (!confirm('Tem certeza que deseja remover este produto?')) return;
            setData(current => {
                current.inventory = current.inventory.filter(item => String(item.id) !== String(productId));
                return current;
            });
            renderInventory();
            showToast('Produto removido.');
        };

        window.editProduct = function (productId) {
            const product = getData().inventory.find(item => String(item.id) === String(productId));
            if (!product) {
                showToast('Produto nao encontrado.');
                return;
            }
            openProductModal(product);
        };

        function filteredInventory(data = getData(), settings = getSettings(data)) {
            return data.inventory.filter(product => {
                const status = getStockStatus(product, settings);
                const categoryMatches = !filters.category || product.category === filters.category;
                const stockMatches = !filters.stock || status.key === filters.stock;
                const searchMatches = !filters.search || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(filters.search);
                return categoryMatches && stockMatches && searchMatches;
            });
        }

        function renderInventory() {
            const data = getData();
            const settings = getSettings(data);
            const products = filteredInventory(data, settings);
            if (!products.length) {
                tableBody.innerHTML = '<tr><td colspan="7" class="px-md py-lg text-center text-on-surface-variant font-body-md">Nenhum produto encontrado</td></tr>';
            } else {
                tableBody.innerHTML = products.map(product => {
                    const status = getStockStatus(product, settings);
                    return `
                        <tr class="border-b border-outline-variant hover:bg-surface-container-low transition-colors group">
                            <td class="px-md py-sm">
                                <div class="flex items-center gap-sm">
                                    <div class="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant flex items-center justify-center shrink-0">
                                        <span class="material-symbols-outlined text-on-surface-variant" style="font-size: 20px;">${escapeHTML(product.icon || 'inventory_2')}</span>
                                    </div>
                                    <span class="font-medium">${escapeHTML(product.name)}</span>
                                </div>
                            </td>
                            <td class="px-md py-sm text-on-surface-variant">${escapeHTML(product.sku)}</td>
                            <td class="px-md py-sm text-on-surface-variant">${escapeHTML(product.category)}</td>
                            <td class="px-md py-sm text-right">${product.qty}</td>
                            <td class="px-md py-sm text-center">
                                <span class="inline-flex items-center px-[12px] py-[4px] rounded-full ${status.className} font-label-caps text-label-caps">${status.text}</span>
                            </td>
                            <td class="px-md py-sm text-right">${formatCurrency(product.price)}</td>
                            <td class="px-sm py-sm text-right">
                                <div class="flex items-center justify-end gap-xs">
                                    <button onclick="adjustStock('${escapeHTML(product.id)}', -1)" class="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs rounded hover:bg-surface-container-high" title="Baixar 1 unidade">remove</button>
                                    <button onclick="adjustStock('${escapeHTML(product.id)}', 1)" class="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs rounded hover:bg-surface-container-high" title="Adicionar 1 unidade">add</button>
                                    <button onclick="editProduct('${escapeHTML(product.id)}')" class="material-symbols-outlined text-on-surface-variant hover:text-primary p-xs rounded hover:bg-surface-container-high" title="Editar produto">edit</button>
                                    <button onclick="deleteProduct('${escapeHTML(product.id)}')" class="material-symbols-outlined text-on-surface-variant hover:text-error p-xs rounded hover:bg-error-container" title="Remover produto">delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            const pagination = document.getElementById('pagination-text');
            if (pagination) pagination.textContent = `Exibindo ${products.length} de ${data.inventory.length} produtos`;
        }

        renderCategoryControls();
        renderInventory();
        window.addEventListener('proledger:data-change', () => {
            renderCategoryControls();
            renderInventory();
        });
    }

    function initFinancePage() {
        if (!document.getElementById('kpi-profit')) return;

        const searchInput = document.querySelector('input[placeholder*="Search"], input[placeholder*="Buscar"]');
        const exportButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Exportar'));
        let query = '';

        searchInput?.addEventListener('input', event => {
            query = event.target.value.toLowerCase();
            renderFinance();
        });

        exportButton?.addEventListener('click', event => {
            event.preventDefault();
            const data = getFinanceViewData();
            downloadCSV('financeiro-proledger.csv', [
                ['Tipo', 'Nome', 'Vencimento', 'Valor', 'Status'],
                ...data.receivables.map(item => ['A receber', item.client, item.dueDate, item.amount, item.status]),
                ...data.payables.map(item => ['A pagar', item.supplier, item.dueDate, item.amount, item.status])
            ]);
            showToast('Relatorio financeiro exportado.');
        });

        function getFinanceViewData() {
            const data = getData();
            const saleReceivables = data.sales
                .filter(sale => sale.paymentStatus !== 'Recebido')
                .map(sale => ({
                    id: `sale-${sale.id}`,
                    client: sale.client,
                    dueDate: sale.createdAt.slice(0, 10),
                    amount: sale.netTotal ?? sale.total,
                    status: sale.paymentStatus || 'A receber'
                }));

            const receivables = dedupeById([...saleReceivables, ...data.finance.receivables]);
            const payables = data.finance.payables;
            return { data, receivables, payables };
        }

        function renderFinance() {
            const { data, receivables, payables } = getFinanceViewData();
            const now = new Date();
            const monthSales = data.sales.filter(sale => {
                const date = parseDate(sale.createdAt);
                return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });
            const profit = monthSales.reduce((sum, sale) => sum + saleProfit(sale), 0);
            const totalReceivable = receivables.reduce((sum, item) => sum + toNumber(item.amount), 0);
            const totalPayable = payables.reduce((sum, item) => sum + toNumber(item.amount), 0);

            setText('kpi-profit', formatCurrency(profit));
            setText('kpi-receivable', formatCurrency(totalReceivable));
            setText('kpi-receivable-count', `${receivables.length} faturas pendentes`);
            setText('kpi-payable', formatCurrency(totalPayable));
            setText('kpi-payable-count', `${payables.length} boletos agendados`);

            renderProfitByProduct(monthSales);
            renderFinanceTable('receivable-table-body', 'receivable-empty-state', receivables, item => [item.client, item.dueDate, item.amount, item.status], 'cliente');
            renderFinanceTable('payable-table-body', 'payable-empty-state', payables, item => [item.supplier, item.dueDate, item.amount, item.status], 'fornecedor');
        }

        function renderProfitByProduct(sales) {
            const container = document.getElementById('profit-by-product-container');
            if (!container) return;

            const grouped = sales.reduce((acc, sale) => {
                acc[sale.productName] = (acc[sale.productName] || 0) + saleProfit(sale);
                return acc;
            }, {});
            const rows = Object.entries(grouped)
                .filter(([name]) => !query || name.toLowerCase().includes(query))
                .sort((a, b) => b[1] - a[1]);

            if (!rows.length) {
                container.innerHTML = '<p class="text-body-md text-secondary text-center p-xl">Nenhum dado de lucro disponivel. Registre vendas para preencher este relatorio.</p>';
                return;
            }

            const max = Math.max(...rows.map(([, value]) => Math.abs(value)), 1);
            container.innerHTML = `
                <div class="flex flex-col gap-sm">
                    ${rows.map(([name, value]) => `
                        <div class="grid grid-cols-[minmax(120px,1fr)_2fr_auto] gap-sm items-center px-sm py-xs hover:bg-surface-container-low rounded">
                            <span class="text-body-sm font-semibold text-primary truncate" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
                            <div class="h-3 bg-surface-container rounded overflow-hidden">
                                <div class="h-full ${value >= 0 ? 'bg-primary-container' : 'bg-error'}" style="width: ${Math.max(4, Math.abs(value) / max * 100)}%"></div>
                            </div>
                            <span class="text-data-tabular font-bold ${value >= 0 ? 'text-tertiary-container' : 'text-error'}">${formatCurrency(value)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderFinanceTable(bodyId, emptyId, items, mapper, typeLabel) {
            const body = document.getElementById(bodyId);
            const empty = document.getElementById(emptyId);
            if (!body) return;

            const visible = items.filter(item => {
                const values = mapper(item).join(' ').toLowerCase();
                return !query || values.includes(query);
            });

            if (!visible.length) {
                body.innerHTML = '';
                empty?.classList.remove('hidden');
                if (empty) empty.textContent = `Nenhuma conta de ${typeLabel} encontrada.`;
                return;
            }

            empty?.classList.add('hidden');
            body.innerHTML = visible.map(item => {
                const [name, dueDate, amount, status] = mapper(item);
                return `
                    <tr class="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                        <td class="p-sm">${escapeHTML(name)}</td>
                        <td class="p-sm">${formatDate(dueDate) || escapeHTML(dueDate)}</td>
                        <td class="p-sm text-right">${formatCurrency(amount)}</td>
                        <td class="p-sm text-center">
                            <span class="inline-block px-3 py-1 ${statusBadgeClasses(status)} rounded-full text-xs font-semibold">${escapeHTML(status)}</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        renderFinance();
        window.addEventListener('proledger:data-change', renderFinance);
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    ready(() => {
        getData();
        fixMojibake();
        standardizeAppShell();
        bindCommonUI();
        initDashboardPage();
        initSalesPage();
        initInventoryPage();
        initFinancePage();
    });
})();
