// Capa de acceso a datos. app.js SOLO llama a las funciones de acá abajo.
// Si mañana cambia la base (otro repo, otra API, un backend real con DB),
// se toca únicamente este archivo — nunca app.js ni la UI.

import { githubBackend } from './backends/backendGithub.js';
// import { localBackend } from './backends/backendLocalStorage.js'; // alternativa offline/dev

const backend = githubBackend; // <- único punto donde se elige el backend activo

export const dataStore = {
    getServicios: () => backend.get('servicios'),
    saveServicios: (servicios) => backend.save('servicios', servicios),

    getPagos: () => backend.get('pagos'),
    savePagos: (pagos) => backend.save('pagos', pagos),
};
