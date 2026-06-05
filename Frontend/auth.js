'use strict';

// ─── Cognito Hosted UI (Authorization Code + PKCE) ─────────────
// Falls back to a mock sign-in flow when window.SWIFTSUPPORT_CONFIG.mockAuth
// is true, so the authenticated UI can be exercised without AWS.

const CFG = window.SWIFTSUPPORT_CONFIG ?? {};
const COGNITO = CFG.cognito ?? {};
const REDIRECT = COGNITO.redirectUri || `${location.origin}/`;

const KEYS = {
    pkce: 'ss.pkce',
    state: 'ss.oauth.state',
    id: 'ss.id_token',
    access: 'ss.access_token',
    refresh: 'ss.refresh_token',
    expires: 'ss.expires_at',
    mock: 'ss.mock.user'
};

const Auth = {
    // Real Cognito is configured?
    isConfigured() { return !!(COGNITO.domain && COGNITO.clientId); },
    // Should the sign-in button appear at all? (real OR mock)
    isInteractive() { return this.isConfigured() || !!CFG.mockAuth; },
    // Is the user signed in (either path)?
    isAuthenticated() {
        if (sessionStorage.getItem(KEYS.mock)) return true;
        const id = sessionStorage.getItem(KEYS.id);
        const exp = Number(sessionStorage.getItem(KEYS.expires) ?? 0);
        return !!id && exp > Date.now();
    },
    isMock() { return !!sessionStorage.getItem(KEYS.mock); },

    idToken() { return sessionStorage.getItem(KEYS.id); },

    user() {
        const mock = sessionStorage.getItem(KEYS.mock);
        if (mock) { try { return JSON.parse(mock); } catch { return null; } }
        const id = this.idToken();
        if (!id) return null;
        try {
            const payload = JSON.parse(atob(id.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return { email: payload.email, sub: payload.sub, name: payload.name ?? payload.email };
        } catch { return null; }
    },

    async login() {
        if (!this.isConfigured() && CFG.mockAuth) {
            sessionStorage.setItem(KEYS.mock, JSON.stringify(CFG.mockUser ?? {
                email: 'demo@swiftsupport.com', name: 'Demo User', sub: 'mock-user-0001'
            }));
            location.reload();
            return;
        }
        const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
        sessionStorage.setItem(KEYS.pkce, verifier);
        sessionStorage.setItem(KEYS.state, state);
        const challenge = base64url(new Uint8Array(
            await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
        ));
        const params = new URLSearchParams({
            client_id: COGNITO.clientId,
            response_type: 'code',
            scope: 'openid email profile',
            redirect_uri: REDIRECT,
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256'
        });
        location.assign(`https://${COGNITO.domain}/oauth2/authorize?${params}`);
    },

    logout() {
        const wasMock = this.isMock();
        for (const k of Object.values(KEYS)) sessionStorage.removeItem(k);
        if (wasMock || !this.isConfigured()) { location.reload(); return; }
        const params = new URLSearchParams({ client_id: COGNITO.clientId, logout_uri: REDIRECT });
        location.assign(`https://${COGNITO.domain}/logout?${params}`);
    },

    async handleCallback() {
        if (!this.isConfigured() || !location.search.includes('code=')) return false;
        const url = new URL(location.href);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const expected = sessionStorage.getItem(KEYS.state);
        const verifier = sessionStorage.getItem(KEYS.pkce);
        history.replaceState({}, '', url.pathname);
        if (!code || !verifier || state !== expected) {
            console.error('OAuth state mismatch');
            return false;
        }
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: COGNITO.clientId,
            code,
            redirect_uri: REDIRECT,
            code_verifier: verifier
        });
        const res = await fetch(`https://${COGNITO.domain}/oauth2/token`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body
        });
        if (!res.ok) { console.error('Token exchange failed', await res.text()); return false; }
        const t = await res.json();
        sessionStorage.setItem(KEYS.id, t.id_token);
        sessionStorage.setItem(KEYS.access, t.access_token);
        if (t.refresh_token) sessionStorage.setItem(KEYS.refresh, t.refresh_token);
        sessionStorage.setItem(KEYS.expires, String(Date.now() + (t.expires_in - 30) * 1000));
        sessionStorage.removeItem(KEYS.pkce);
        sessionStorage.removeItem(KEYS.state);
        return true;
    }
};

function base64url(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

window.SwiftAuth = Auth;
