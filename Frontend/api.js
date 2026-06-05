'use strict';

// Thin API client. All requests carry the Cognito id-token as a Bearer
// header so API Gateway's Cognito authorizer can authenticate the caller.

const Api = (() => {
    const cfg = window.SWIFTSUPPORT_CONFIG ?? {};
    const base = (cfg.apiBaseUrl ?? '').replace(/\/$/, '');

    const isLive = () => !!base && window.SwiftAuth?.isConfigured();

    const request = async (path, init = {}) => {
        const token = window.SwiftAuth?.idToken();
        if (!token) throw new Error('not authenticated');
        const res = await fetch(`${base}${path}`, {
            ...init,
            headers: {
                'content-type': 'application/json',
                authorization: token,
                ...(init.headers ?? {})
            }
        });
        if (res.status === 401) { window.SwiftAuth.logout(); throw new Error('session expired'); }
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`API ${res.status}: ${text || res.statusText}`);
        }
        return res.status === 204 ? null : res.json();
    };

    return {
        isLive,
        list: () => request('/tickets').then(r => r.items ?? []),
        get: id => request(`/tickets/${encodeURIComponent(id)}`),
        create: ticket => request('/tickets', { method: 'POST', body: JSON.stringify(ticket) })
    };
})();

window.SwiftApi = Api;
