// La contraseña vive solo acá, en memoria, mientras la pestaña esté abierta.
// Nunca se persiste en localStorage/sessionStorage ni se envía a ningún lado:
// solo se usa en el navegador para cifrar/descifrar antes de hablar con el backend.

let claveSesion = null;

export function setClaveSesion(nuevaClave) {
    claveSesion = nuevaClave;
}

export function getClaveSesion() {
    return claveSesion;
}

export function hayClaveSesion() {
    return !!claveSesion;
}
