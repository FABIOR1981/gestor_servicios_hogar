// Backend que habla con nuestra propia Netlify Function, nunca directo con GitHub.
// El token vive solo del lado del servidor (variable de entorno en Netlify).

const BASE = '/.netlify/functions/data';

async function get(resource) {
    const res = await fetch(`${BASE}?resource=${resource}`);
    if (!res.ok) {
        throw new Error(`No se pudo leer "${resource}" (HTTP ${res.status})`);
    }
    return res.json();
}

async function save(resource, data) {
    const res = await fetch(`${BASE}?resource=${resource}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `No se pudo guardar "${resource}" (HTTP ${res.status})`);
    }
    return res.json();
}

export const githubBackend = { get, save };
