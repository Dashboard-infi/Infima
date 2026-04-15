const API_BASE = process.env.REACT_APP_API_URL || 'http://10.5.0.2:3001';
const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

async function request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    headers['X-App-Version'] = APP_VERSION;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (res.status === 426) {
        // Version obsolete — notifier Electron pour forcer update
        if (window.electronAPI && window.electronAPI.forceUpdate) {
            window.electronAPI.forceUpdate();
        }
        throw new Error('Mise a jour obligatoire requise');
    }
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return null;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
}

export const api = {
    // Auth
    login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    // Profil
    getProfil: () => request('/api/profil'),
    updateProfil: (body) => request('/api/profil', { method: 'PUT', body: JSON.stringify(body) }),

    // Patients
    getPatients: () => request('/api/patients'),
    getPatient: (id) => request(`/api/patients/${id}`),
    createPatient: (body) => request('/api/patients', { method: 'POST', body: JSON.stringify(body) }),
    updatePatient: (id, body) => request(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletePatient: (id, reason) => request(`/api/patients/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

    // Photos
    getPhotos: (patientId) => request(`/api/patients/${patientId}/photos`),
    uploadPhoto: (patientId, formData) => request(`/api/patients/${patientId}/photos`, { method: 'POST', body: formData, headers: {} }),
    deletePhoto: (photoId) => request(`/api/photos/${photoId}`, { method: 'DELETE' }),
    getPhotoDownloadUrl: (photoId) => `${API_BASE}/api/photos/${photoId}/download`,

    // Vitaux
    getVitaux: (patientId) => request(`/api/patients/${patientId}/vitaux`),
    addVitaux: (patientId, body) => request(`/api/patients/${patientId}/vitaux`, { method: 'POST', body: JSON.stringify(body) }),

    // Agenda
    getAgenda: (params) => request(`/api/agenda?${new URLSearchParams(params)}`),
    createRdv: (body) => request('/api/agenda', { method: 'POST', body: JSON.stringify(body) }),
    updateRdv: (id, body) => request(`/api/agenda/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteRdv: (id) => request(`/api/agenda/${id}`, { method: 'DELETE' }),

    // Diagrammes
    getDiagrammes: (params) => request(`/api/diagrammes?${new URLSearchParams(params)}`),
    getDiagramme: (id) => request(`/api/diagrammes/${id}`),
    createDiagramme: (body) => request('/api/diagrammes', { method: 'POST', body: JSON.stringify(body) }),
    updateCases: (id, body) => request(`/api/diagrammes/${id}/cases`, { method: 'PUT', body: JSON.stringify(body) }),
    signerDiagramme: (id, body) => request(`/api/diagrammes/${id}/signer`, { method: 'PUT', body: JSON.stringify(body) }),

    // Tournées
    getTournees: (params) => request(`/api/tournees?${new URLSearchParams(params)}`),
    getTournee: (id) => request(`/api/tournees/${id}`),
    createTournee: (body) => request('/api/tournees', { method: 'POST', body: JSON.stringify(body) }),
    updateEtape: (tourneeId, etapeId, body) => request(`/api/tournees/${tourneeId}/etape/${etapeId}`, { method: 'PUT', body: JSON.stringify(body) }),

    // KM
    getKm: (params) => request(`/api/km?${new URLSearchParams(params)}`),

    // Planning
    getPlanning: (params) => request(`/api/planning?${new URLSearchParams(params)}`),
    createPlanning: (body) => request('/api/planning', { method: 'POST', body: JSON.stringify(body) }),
    updatePlanning: (id, body) => request(`/api/planning/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletePlanning: (id) => request(`/api/planning/${id}`, { method: 'DELETE' }),

    // Messages
    getMessages: () => request('/api/messages'),
    sendMessage: (body) => request('/api/messages', { method: 'POST', body: JSON.stringify(body) }),
    markRead: (id) => request(`/api/messages/${id}/lire`, { method: 'PUT' }),

    // Infirmiers
    getInfirmiers: () => request('/api/infirmiers'),

    // Notifications
    getNotifications: () => request('/api/notifications'),
    markNotifRead: (id) => request(`/api/notifications/${id}/lire`, { method: 'PUT' }),
    markAllNotifsRead: () => request('/api/notifications/lire-tout', { method: 'PUT' }),

    // Storage
    getStorage: () => request('/api/storage'),
};
