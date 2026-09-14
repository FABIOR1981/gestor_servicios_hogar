// Backend offline/de desarrollo. Mismo contrato get/save que backendGithub,
// así se puede intercambiar en dataStore.js sin tocar el resto de la app.

const KEYS = {
    servicios: 'gsh_servicios',
};

async function get(resource) {
    const raw = localStorage.getItem(KEYS[resource]);
    return raw ? JSON.parse(raw) : [];
}

async function save(resource, data) {
    localStorage.setItem(KEYS[resource], JSON.stringify(data, null, 2));
    return data;
}

export const localBackend = { get, save };
