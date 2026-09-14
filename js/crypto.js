// Cifrado simétrico AES-GCM con clave derivada por PBKDF2, tal como en
// cifrar.js / decifrar.js. Acá quedan como funciones de módulo reutilizables.

export async function encriptarJSON(datosObjeto, claveSecreta) {
    const encoder = new TextEncoder();
    const datosTexto = JSON.stringify(datosObjeto);

    const keyMaterial = await crypto.subtle.importKey(
        "raw", encoder.encode(claveSecreta), "PBKDF2", false, ["deriveKey"]
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(datosTexto)
    );

    // Empaquetamos salt, iv y contenido cifrado en un único JSON de texto,
    // que es lo que termina guardado como servicios.json en el repo bd.
    return JSON.stringify({
        salt: Array.from(salt),
        iv: Array.from(iv),
        data: btoa(String.fromCharCode(...new Uint8Array(encryptedContent)))
    });
}

export async function descifrarJSON(paqueteCifradoTexto, claveSecreta) {
    let paquete;
    try {
        paquete = JSON.parse(paqueteCifradoTexto);
    } catch {
        throw new Error('El archivo de datos no tiene un formato válido.');
    }

    if (!paquete || !paquete.salt || !paquete.iv || !paquete.data) {
        throw new Error('El archivo no contiene datos cifrados reconocibles.');
    }

    const encoder = new TextEncoder();
    const salt = new Uint8Array(paquete.salt);
    const iv = new Uint8Array(paquete.iv);
    const encryptedData = Uint8Array.from(atob(paquete.data), c => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
        "raw", encoder.encode(claveSecreta), "PBKDF2", false, ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    try {
        const decryptedContent = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encryptedData
        );
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedContent));
    } catch {
        // AES-GCM falla la verificación de integridad si la clave es incorrecta:
        // es la forma normal de detectar "contraseña equivocada".
        throw new Error('Contraseña incorrecta.');
    }
}
