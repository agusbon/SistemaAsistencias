// Cola offline de asistencia (frente 7 / PWA). Ver documentacion/Gustavo-EDT-offline-pwa.md
// para el plan completo. Depende de Dexie.js (wwwroot/lib/dexie).
(function () {
    if (typeof Dexie === 'undefined') return; // Si no cargó la librería, no rompemos el resto de la página.

    var db = new Dexie('is124-asistencia-offline');
    db.version(1).stores({
        // ++id: clave autogenerada local, solo para Dexie. clientGuid es la clave real
        // que el servidor usa para deduplicar. enviado: 0 = pendiente, 1 = ya sincronizado.
        pendientes: '++id, clientGuid, enviado, maId, fecha',
    });

    function getAntiforgeryToken() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : null;
    }

    function generarGuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        // Respaldo simple para navegadores viejos sin crypto.randomUUID.
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /// Encola en IndexedDB una tanda de asistencia (todo el formulario de una cátedra/fecha).
    /// filas: [{ usId, presente, justificacion }, ...]
    async function encolarAsistencia(maId, fecha, filas) {
        var ahora = new Date().toISOString();
        var registros = filas.map(function (fila) {
            return {
                clientGuid: generarGuid(),
                maId: maId,
                fecha: fecha,
                fechaCarga: ahora,
                usId: fila.usId,
                presente: fila.presente,
                justificacion: fila.justificacion,
                enviado: 0,
            };
        });
        await db.pendientes.bulkAdd(registros);
        return registros.length;
    }

    async function contarPendientes() {
        return db.pendientes.where('enviado').equals(0).count();
    }

    /// Manda al servidor lo que esté pendiente. No asume que todo salga bien: cada fila
    /// se marca enviada según lo que responda el servidor, nunca por adelantado.
    async function sincronizarPendientes() {
        var pendientes = await db.pendientes.where('enviado').equals(0).toArray();
        if (pendientes.length === 0) return { enviados: 0, fallidos: 0 };

        var token = getAntiforgeryToken();
        var body = pendientes.map(function (p) {
            return {
                clientGuid: p.clientGuid,
                usId: p.usId,
                maId: p.maId,
                fecha: p.fecha,
                fechaCarga: p.fechaCarga,
                presente: p.presente,
                justificacion: p.justificacion,
            };
        });

        var respuesta;
        try {
            respuesta = await fetch('/api/asistencias/sincronizar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                },
                body: JSON.stringify(body),
            });
        } catch (e) {
            // Sin conexión todavía (o se cortó de nuevo a mitad de camino) — se reintenta
            // la próxima vez que dispare el evento 'online' o el botón manual.
            return { enviados: 0, fallidos: pendientes.length, sinConexion: true };
        }

        if (!respuesta.ok) {
            // 401 (sesión vencida mientras el dispositivo estaba offline) u otro error del
            // servidor: se deja todo en la cola tal cual, no se pierde nada — el docente
            // vuelve a loguearse y aprieta "Sincronizar ahora" de nuevo, sin tener que
            // volver a cargar la asistencia.
            return {
                enviados: 0,
                fallidos: pendientes.length,
                statusHttp: respuesta.status,
                sesionVencida: respuesta.status === 401,
            };
        }

        var resultados = await respuesta.json();
        var enviados = 0;
        for (var i = 0; i < resultados.length; i++) {
            var r = resultados[i];
            if (r.ok) {
                await db.pendientes.where('clientGuid').equals(r.clientGuid).modify({ enviado: 1 });
                enviados++;
            }
        }
        // Limpieza: no tiene sentido acumular filas ya enviadas para siempre en el dispositivo.
        await db.pendientes.where('enviado').equals(1).delete();

        return { enviados: enviados, fallidos: pendientes.length - enviados };
    }

    // Envuelve sincronizarPendientes para que cualquier disparador (evento 'online', carga
    // de página, botón manual) avise por un evento propio — así la pantalla que esté abierta
    // puede actualizar el banner de pendientes/sesión vencida sin importar quién disparó la
    // sincronización.
    async function sincronizarYAvisar() {
        var resultado = await sincronizarPendientes();
        window.dispatchEvent(new CustomEvent('offline-asistencia:sync', { detail: resultado }));
        return resultado;
    }

    window.OfflineAsistencia = {
        encolarAsistencia: encolarAsistencia,
        contarPendientes: contarPendientes,
        sincronizarPendientes: sincronizarYAvisar,
    };

    // Sincronización automática al recuperar señal + al cargar cualquier página logueada
    // como docente (por si ya había señal pero el evento 'online' nunca llegó a disparar).
    window.addEventListener('online', function () {
        sincronizarYAvisar();
    });
    document.addEventListener('DOMContentLoaded', function () {
        if (navigator.onLine) sincronizarYAvisar();
    });
})();
