// Proxy entre el front-end y GitHub. El token nunca sale de acá.
// Variables de entorno esperadas en Netlify:
//   GITHUB_TOKEN      -> fine-grained token con Contents: Read and write, scoped al repo bd
//   GITHUB_OWNER      -> FABIOR1981
//   GITHUB_REPO       -> bd
//   GITHUB_BASE_PATH  -> gestor_Servicios

const GITHUB_API = 'https://api.github.com';
const RECURSOS_VALIDOS = ['servicios', 'pagos'];

exports.handler = async (event) => {
    const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BASE_PATH } = process.env;
    const resource = event.queryStringParameters && event.queryStringParameters.resource;

    if (!RECURSOS_VALIDOS.includes(resource)) {
        return jsonResponse(400, { error: `Parámetro "resource" inválido. Debe ser uno de: ${RECURSOS_VALIDOS.join(', ')}` });
    }

    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BASE_PATH) {
        return jsonResponse(500, { error: 'Faltan variables de entorno de GitHub en Netlify.' });
    }

    const filePath = `${GITHUB_BASE_PATH}/${resource}.json`;
    const fileUrl = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
    const headers = {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
    };

    try {
        if (event.httpMethod === 'GET') {
            return await leerArchivo(fileUrl, headers);
        }

        if (event.httpMethod === 'PUT') {
            return await guardarArchivo(fileUrl, headers, event.body, resource);
        }

        return jsonResponse(405, { error: 'Método no soportado. Usá GET o PUT.' });
    } catch (err) {
        return jsonResponse(500, { error: err.message || 'Error inesperado en la function.' });
    }
};

async function leerArchivo(fileUrl, headers) {
    const res = await fetch(fileUrl, { headers });

    if (res.status === 404) {
        // El archivo todavía no existe en el repo: devolvemos lista vacía en vez de error.
        return jsonResponse(200, []);
    }
    if (!res.ok) {
        return jsonResponse(res.status, { error: 'No se pudo leer el archivo desde GitHub.' });
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: content };
}

async function guardarArchivo(fileUrl, headers, body, resource) {
    // Hay que traer el sha actual del archivo antes de poder pisarlo.
    const actual = await fetch(fileUrl, { headers });
    const shaActual = actual.ok ? (await actual.json()).sha : undefined;
    // Si actual.status es 404, shaActual queda undefined y GitHub crea el archivo nuevo.

    const contenidoBase64 = Buffer.from(body, 'utf-8').toString('base64');

    const putRes = await fetch(fileUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Actualiza ${resource}.json desde gestor-servicios-hogar`,
            content: contenidoBase64,
            sha: shaActual,
        }),
    });

    if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        return jsonResponse(putRes.status, { error: err.message || 'No se pudo guardar el archivo en GitHub.' });
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body };
}

function jsonResponse(statusCode, obj) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
