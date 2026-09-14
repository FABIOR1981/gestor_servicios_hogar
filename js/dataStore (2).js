// Capa de acceso a datos. app.js SOLO llama a las funciones de acá abajo.
// Acá es donde se cifra/descifra — el backend nunca ve los datos en claro,
// y app.js nunca sabe que existe cifrado.

import { githubBackend } from './backends/backendGithub.js';
// import { localBackend } from './backends/backendLocalStorage.js'; // alternativa offline/dev

import { encriptarJSON, descifrarJSON } from './crypto.js';
import { getClaveSesion } from './session.js';

const backend = githubBackend; // <- único punto donde se elige el backend activo

async function leerYDescifrar(resource) {
    const clave = getClaveSesion();
    if (!clave) throw new Error('No hay una sesión iniciada (falta la contraseña).');

    const texto = await backend.get(resource);
    if (!texto || !texto.trim() || texto.trim() === '[]') {
        return []; // archivo nuevo/vacío: todavía no hay nada cifrado que leer
    }
    return descifrarJSON(texto, clave);
}

async function cifrarYGuardar(resource, datos) {
    const clave = getClaveSesion();
    if (!clave) throw new Error('No hay una sesión iniciada (falta la contraseña).');

    const paqueteCifrado = await encriptarJSON(datos, clave);
    await backend.save(resource, paqueteCifrado);
    return datos;
}

export const dataStore = {
    getServicios: () => leerYDescifrar('servicios'),
    saveServicios: (servicios) => cifrarYGuardar('servicios', servicios),
};
