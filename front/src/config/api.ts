// API Configuration
// Use relative URLs in production (proxied by nginx)
// Use 127.0.0.1 in development (proxied by Vite dev server)
const API_BASE_URL = import.meta.env.DEV ? '' : '';
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE_URL = import.meta.env.DEV
    ? 'ws://127.0.0.1:8000'
    : `${protocol}//${window.location.host}`;

export const API_CONFIG = {
    // HTTP endpoints - use relative URLs (will be proxied by nginx/vite)
    BASE: `${API_BASE_URL}/api`,

    // WebSocket endpoints
    WS_SIMULATION: `${WS_BASE_URL}/api/ws/simulation`,

    // Network endpoints
    NETWORK: {
        SAVE: `${API_BASE_URL}/api/network/save`,
        LOAD_SAVED: (name: string, networkId?: string | null) =>
            `${API_BASE_URL}/api/network/load_saved/${encodeURIComponent(name)}${networkId ? `?network_id=${encodeURIComponent(networkId)}` : ''}`,
        LIST_SAVED: `${API_BASE_URL}/api/network/list_saved`,
        LIST_TEMPLATES: `${API_BASE_URL}/api/network/list_templates`,
        LOAD_GENN: `${API_BASE_URL}/api/network/load_genn`,
        DELETE: (id: string) => `${API_BASE_URL}/api/network/delete/${encodeURIComponent(id)}`,
    },

    // Simulation endpoints
    SIMULATION: {
        RUN_OFFLINE: `${API_BASE_URL}/api/simulation/run_offline`,
        BENCHMARK: `${API_BASE_URL}/api/simulation/benchmark`,
    },

    // Input endpoints
    INPUT: {
        EXECUTE: `${API_BASE_URL}/api/input/execute`,
    },

    // Auth endpoints
    AUTH: {
        LOGIN: `${API_BASE_URL}/api/auth/login`,
        REGISTER: `${API_BASE_URL}/api/auth/register`,
        GUEST: `${API_BASE_URL}/api/auth/guest`,
        UPGRADE: `${API_BASE_URL}/api/auth/upgrade`,
        ME: `${API_BASE_URL}/api/auth/me`,
        GOOGLE_LOGIN: `${API_BASE_URL}/api/auth/google/login`,
    },
};
