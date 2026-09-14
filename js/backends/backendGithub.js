// Backend que habla con nuestra propia Netlify Function, nunca directo con GitHub.
// Trabaja con texto plano: quien decide si ese texto es JSON normal o un
// paquete cifrado es dataStore.js, no este archivo.

const BASE = '/.netlify/functions/data';

async function get(resource) {
    const res = await fetch(`${BASE}?resource=${resource}`);
    if (!res.ok) {
        throw new Error(`No se pudo leer "${resource}" (HTTP ${res.status})`);
    }
    return res.text();
}

async function save(resource, texto) {
    const res = await fetch(`${BASE}?resource=${resource}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: texto,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `No se pudo guardar "${resource}" (HTTP ${res.status})`);
    }
    return texto;
}

export const githubBackend = { get, save };
