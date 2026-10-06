# Registro de Servicios del Hogar

Aplicación web personal para tener en un solo lugar los servicios y cuentas de la casa: UTE, ANTEL, inmueble, vehículos, colegio y otros. Para cada uno se anotan el número de cuenta, contrato o padrón y notas. Los datos se guardan cifrados.

## Funcionalidades

- **Acceso con contraseña**: la misma contraseña se usa para cifrar y descifrar los datos.
- **Categorías**: Hogar (UTE, ANTEL, etc.), Inmueble, Vehículos, Colegio y Varios.
- **Alta, edición y borrado** de servicios, con nombres sugeridos según la categoría.
- Campos de cada servicio: concepto, número de cuenta / contrato / padrón y notas.
- **Exportar a Word**, en versión completa o compacta, para imprimir o archivar.
- Indicador del estado de sincronización.

## Cómo se usa

1. Abrí la app e ingresá la contraseña.
2. Elegí una categoría y cargá un servicio con **Guardar Servicio**.
3. Para modificar o borrar, usá las acciones de la tabla.
4. Para tener una copia en papel o en archivo, usá **Exportar Servicios (Word)** o la versión compacta.

## Privacidad

- La contraseña vive solo en la memoria de la pestaña. No se guarda en el navegador ni se envía a ningún servidor.
- Los datos se cifran en el navegador (AES-GCM con clave derivada por PBKDF2) antes de salir de la computadora. Lo que se guarda en GitHub es solo el paquete cifrado.
- Si se pierde la contraseña, los datos no se pueden recuperar.

## Cómo funciona

- El frontend es HTML, JavaScript modular y Tailwind (desde CDN), sin build.
- `js/dataStore.js` es la única capa de datos: cifra antes de guardar y descifra al leer.
- `js/backends/backendGithub.js` habla con la Netlify Function `netlify/functions/data.js`, que guarda el archivo en un repositorio de GitHub. El token nunca llega al navegador.
- `js/backends/backendLocalStorage.js` es una alternativa para usar sin conexión o durante el desarrollo.

## Publicación en Netlify

`netlify.toml` ya define la carpeta de funciones. Configurar estas variables de entorno:

| Variable | Para qué sirve |
|---|---|
| `GITHUB_TOKEN` | Token fine-grained con permiso *Contents: Read and write* sobre el repositorio de datos. |
| `GITHUB_OWNER` | Dueño del repositorio de datos (por ejemplo `FABIOR1981`). |
| `GITHUB_REPO` | Repositorio de datos (por ejemplo `bd`). |
| `GITHUB_BASE_PATH` | Carpeta dentro de ese repositorio (por ejemplo `gestor_Servicios`). |

## Estructura

```
index.html                         Pantalla de acceso y registro de servicios
css/styles.css                     Estilos
js/app.js                          Lógica de la interfaz
js/dataStore.js                    Cifrado y acceso a datos
js/crypto.js                       Cifrado AES-GCM + PBKDF2
js/session.js                      Contraseña en memoria
js/export-word.js                  Exportación a Word
js/backends/                       Backend GitHub (vía Netlify) y backend local
netlify/functions/data.js          Lee y guarda el archivo cifrado en GitHub
netlify.toml                       Configuración de Netlify
```
