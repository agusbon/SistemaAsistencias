const CACHE_VERSION = 'is124-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
// A propósito NO atada a CACHE_VERSION: acá se va acumulando cada pantalla real
// que el docente visitó con señal. Si la atamos a la versión, cada vez que
// subimos un cambio de CSS/JS (que solo debería refrescar lo estático) se
// borraba junto con eso todo el historial de páginas ya guardado, dejando al
// docente sin nada para ver la próxima vez que abriera la app sin conexión.
const PAGES_CACHE = 'is124-pages';

const APP_SHELL = [
    '/css/style.css',
    '/js/script.js',
    '/lib/jquery/dist/jquery.min.js',
    '/images/logo.png',
    '/images/icons/icon-192.png',
    '/images/icons/icon-512.png',
    '/manifest.json',
    '/offline.html',
    // Pantalla pública (no requiere sesión) — se precachea para que abrir la
    // app sin señal, incluso en el primerísimo arranque, muestre el login de
    // verdad en vez del cartel genérico de "sin conexión".
    '/Account/Login',
    // Frente 7 (PWA offline): la cola de asistencia necesita Dexie disponible
    // localmente aunque la primera carga de la pantalla haya sido sin señal.
    '/lib/dexie/dist/dexie.min.js',
    '/js/offline-asistencia.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith('is124-') && key !== STATIC_CACHE && key !== PAGES_CACHE)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Solo GET: los POST (guardar asistencia, login, altas/bajas) siempre van directo a la red.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Navegación (las páginas .cshtml renderizadas): red primero, con la última copia
    // vista como respaldo si no hay conexión, y una página de "sin conexión" si tampoco hay copia.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() =>
                    caches.match(request).then((cached) => {
                        if (cached) return cached;
                        // El start_url de la PWA instalada (manifest.json) pide "/?source=pwa" —
                        // esa URL exacta nunca se cachea sola si el docente siempre entró por
                        // "Inicio" del menú (que pide "/" sin ese parámetro). Sin esto, abrir el
                        // ícono instalado en frío sin señal siempre caía al cartel de "sin
                        // conexión" aunque la sesión ya estuviera guardada y "/" sí tuviera una
                        // copia cacheada de antes.
                        if (url.pathname === '/') {
                            return caches
                                .match('/', { ignoreSearch: true })
                                .then((home) => home || caches.match('/offline.html'));
                        }
                        return caches.match('/offline.html');
                    })
                )
        );
        return;
    }

    // Estáticos (css/js/imágenes): cache primero, red como respaldo y actualización silenciosa.
    if (STATIC_CACHE_EXTENSIONS(url.pathname)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const network = fetch(request)
                    .then((response) => {
                        const copy = response.clone();
                        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
                        return response;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        );
    }
});

function STATIC_CACHE_EXTENSIONS(pathname) {
    return /\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf)$/i.test(pathname);
}
