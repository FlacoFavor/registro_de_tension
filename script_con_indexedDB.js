// ==========================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN (INDEXEDDB)
// ==========================================
const DB_NAME = "ControlTensionDB";
const DB_VERSION = 1;
const STORE_NAME = "registros";
const STORE_MEDS = "medicamentos";
const STORE_TOMAS = "historial_tomas";

// Función centralizada para abrir la conexión mediante Promesas
function conectarDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Almacén 1: Registros de tensión
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
            // Almacén 2: Listado de medicamentos
            if (!db.objectStoreNames.contains(STORE_MEDS)) {
                db.createObjectStore(STORE_MEDS, { keyPath: "id" });
            }
            // Almacén 3: Historial de tomas SOS con ID incremental automático
            if (!db.objectStoreNames.contains(STORE_TOMAS)) {
                db.createObjectStore(STORE_TOMAS, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Inicializador que migra datos antiguos de localStorage de forma segura
async function initApp() {
    try {
        const db = await conectarDB();
        
        // MIGRACIÓN 1: Registros de tensión
        const antiguoStorage = localStorage.getItem('health_final_v1');
        if (antiguoStorage) {
            const logsAntiguos = JSON.parse(antiguoStorage);
            if (Array.isArray(logsAntiguos) && logsAntiguos.length > 0) {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                logsAntiguos.forEach(r => store.put(r));
                tx.oncomplete = () => localStorage.removeItem('health_final_v1');
            } else {
                localStorage.removeItem('health_final_v1');
            }
        }

        // MIGRACIÓN 2: Lista de medicamentos
        const antiguoMeds = localStorage.getItem('meds_v1');
        if (antiguoMeds) {
            const medsJson = JSON.parse(antiguoMeds);
            if (Array.isArray(medsJson) && medsJson.length > 0) {
                const tx = db.transaction(STORE_MEDS, "readwrite");
                const store = tx.objectStore(STORE_MEDS);
                medsJson.forEach(m => store.put(m));
                tx.oncomplete = () => localStorage.removeItem('meds_v1');
            } else {
                localStorage.removeItem('meds_v1');
            }
        }

        // MIGRACIÓN 3: Historial de tomas SOS
        const antiguoTomas = localStorage.getItem('tomas_v1');
        if (antiguoTomas) {
            const tomasJson = JSON.parse(antiguoTomas);
            if (Array.isArray(tomasJson) && tomasJson.length > 0) {
                const tx = db.transaction(STORE_TOMAS, "readwrite");
                const store = tx.objectStore(STORE_TOMAS);
                // Invertimos el orden para ingresarlos cronológicamente en el autoincremental
                tomasJson.reverse().forEach(t => {
                    delete t.id; 
                    store.add(t);
                });
                tx.oncomplete = () => localStorage.removeItem('tomas_v1');
            } else {
                localStorage.removeItem('tomas_v1');
            }
        }

        // Renderizado inicial completo tras abrir la BD
        setNow();
        render();
        renderMeds();
        renderHistorial();
    } catch (err) {
        console.error("Error al inicializar la base de datos:", err);
        // Si falla la BD, intentamos renderizar lo que se pueda para no romper la UI
        render();
        renderMeds();
        renderHistorial();
    }
}

// Ejecutar la inicialización global inmediatamente al cargar el script
initApp();

// ==========================================
// 2. UTILIDADES DE TIEMPO Y ESTADO (IGUALES)
// ==========================================
function obtenerMinutos(horaStr) {
    if (!horaStr) return 9999; 
    const [h, m] = horaStr.split(':').map(Number);
    return (h * 60) + m;
}

function esReciente(horaUltima) {
    if (!horaUltima) return false;
    const ahora = new Date();
    const minAhora = (ahora.getHours() * 60) + ahora.getMinutes();
    const minToma = obtenerMinutos(horaUltima);
    
    let dif = minAhora - minToma;
    if (dif < 0) dif += 1440; 
    return dif < 240; // Menos de 4 horas
}

const setNow = () => {
    const d = new Date();
    document.getElementById('f').value = d.toISOString().split('T')[0];
    document.getElementById('h').value = d.toTimeString().slice(0,5);
};

function getStatus(s, d) {
    if (s >= 180 || d >= 120) return { label: 'CRI', class: 'status-crisis' };
    if (s >= 140 || d >= 90)  return { label: 'A2', class: 'status-stage2' };
    if (s >= 130 || d >= 80)  return { label: 'A1', class: 'status-stage1' };
    if (s >= 120 && d < 80)   return { label: 'ELE', class: 'status-elevated' };
    return { label: 'NOR', class: 'status-normal' };
}

const injectBaseStyles = () => {
    if (document.getElementById('health-base-styles')) return;
    const style = document.createElement('style');
    style.id = 'health-base-styles';
    style.innerHTML = `
        .month-group { margin-bottom: 10px; border-bottom: 1px solid #444; }
        .month-header { cursor: pointer; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; color: #eee; background: #456; }
        .month-content { display: none; padding-top: 10px; padding: 0 .5rem; background: #eee; }
        .month-group.is-open .month-content { display: block; }
        .arrow-icon { display: inline-block; transition: transform 0.3s ease; width: 1.5rem; text-align: center; transform: rotate(-90deg); }
        .is-open .arrow-icon { transform: rotate(0deg); opacity: 1; }
    `;
    document.head.appendChild(style);
};
// ==========================================
// 3. CONTROL DE TENSIÓN ARTERIAL (CRUD)
// ==========================================

// Helper para extraer todos los registros de tensión ordenados cronológicamente
async function obtenerTodosLosLogs() {
    const db = await conectarDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
            const list = req.result || [];
            // Conservamos tu ordenamiento original por fecha y hora
            list.sort((a,b) => new Date(a.f+'T'+a.h) - new Date(b.f+'T'+b.h));
            resolve(list);
        };
    });
}

async function add() {
    const s = parseInt(document.getElementById('s').value), 
          d = parseInt(document.getElementById('d').value), 
          p = parseInt(document.getElementById('p').value), 
          n = document.getElementById('n').value,
          f = document.getElementById('f').value,
          h = document.getElementById('h').value;

    if(!s || !d || !p) return;

    try {
        const db = await conectarDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        
        const nuevoRegistro = { id: Date.now(), f, h, s, d, p, n };
        store.add(nuevoRegistro);
        
        tx.oncomplete = () => {
            ['s','d','p','n'].forEach(id => document.getElementById(id).value = '');
            setNow();
            render();
        };
    } catch (err) {
        console.error("Error al guardar la medición de tensión:", err);
    }
}

async function render() {
    injectBaseStyles();
    const logs = await obtenerTodosLosLogs();
    const container = document.getElementById('log-list');
    container.innerHTML = '';

    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const groups = {};

    // Agrupar del más nuevo al más viejo
    [...logs].reverse().forEach(r => {
        const d = new Date(r.f + 'T' + r.h);
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
    });

    Object.keys(groups).forEach((monthYear, index) => {
        const openClass = index === 0 ? 'is-open' : ''; // Solo abre el primer mes por defecto

        let html = `
            <div class="month-group ${openClass}">
                <div class="month-header" onclick="this.parentElement.classList.toggle('is-open')">
                    <span class="arrow-icon">▼</span>
                    <span style="font-weight: bold;">${monthYear}</span>
                </div>
                <div class="month-content">`;

        groups[monthYear].forEach(r => {
            const st = getStatus(r.s, r.d);
            const dateShort = r.f.split('-').slice(1).reverse().join('/');

            html += `
                <div>
                    <div class="log-item">
                        <span class="col-time">${dateShort} ${r.h}</span>
                        <span class="col-data">${r.s}/${r.d}<span class="col-pul">${r.p}</span></span>
                        <span class="col-note"></span>
                        <span class="badge ${st.class}">${st.label}</span>
                        <span style="color:#fff; cursor:pointer; font-weight:bold; width: 1.5rem; height: 1.5rem; line-height: 1.2; text-align:center; border-radius: 50%; background: #ab2c2c;" onclick="del(${r.id})">×</span>
                    </div>
                    ${ r.n ? `<div class="col-note" style="margin-left: 10px; font-size: 0.9em; opacity: 0.7;">${r.n}</div>` : '' }
                </div>`;
        });

        html += `</div></div>`;
        container.innerHTML += html;
    });
}

async function del(id) {
    if(confirm("¿Borrar?")) {
        try {
            const db = await conectarDB();
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.delete(id);
            tx.oncomplete = () => render();
        } catch (err) {
            console.error("Error al eliminar la medición:", err);
        }
    }
}

async function clearAll() {
    if(confirm("¿Reset total?")) {
        try {
            const db = await conectarDB();
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => render();
        } catch (err) {
            console.error("Error al vaciar los registros de tensión:", err);
        }
    }
}

// ==========================================
// 4. IMPORTACIÓN / EXPORTACIÓN (CSV)
// ==========================================
async function exportCSV() {
    const logs = await obtenerTodosLosLogs();
    if (logs.length === 0) return alert("No hay datos para exportar.");

    let csv = "Fecha;Hora;Sistolica;Diastolica;Pulso;Nota\n";
    logs.forEach(r => {
        csv += `${r.f};${r.h};${r.s};${r.d};${r.p};"${r.n || ''}"\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salud_${new Date().toISOString().slice(0,10).split('-').reverse().join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ".csv, text/csv, text/plain, application/vnd.ms-excel";

    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async event => {
            try {
                const lines = event.target.result.split('\n').filter(line => line.trim() !== "");
                const rows = lines.slice(1); // Omitimos la cabecera del CSV

                const importedLogs = rows.map((line, index) => {
                    let [f, h, s, d, p, n] = line.split(';').map(v => v.replace(/^"|"$/g, ''));
                    return { 
                        id: Date.now() + index, 
                        f, h, 
                        s: parseInt(s), 
                        d: parseInt(d), 
                        p: parseInt(p), 
                        n: n || "" 
                    };
                });

                if (confirm(`Se han encontrado ${importedLogs.length} registros. ¿Deseas importarlos?`)) {
                    const db = await conectarDB();
                    const tx = db.transaction(STORE_NAME, "readwrite");
                    const store = tx.objectStore(STORE_NAME);
                    
                    // Comportamiento original: Limpia y sobreescribe con lo del archivo
                    store.clear(); 
                    importedLogs.forEach(r => store.add(r));

                    tx.oncomplete = () => {
                        alert("Importación completada con éxito.");
                        render();
                    };
                }
            } catch (err) {
                alert("Error: El formato del archivo no es válido.");
            }
        };
        reader.readAsText(file, "UTF-8");
    };
    input.click();
}
// ==========================================
// 5. CONTROL DE MEDICAMENTOS (CRUD)
// ==========================================

function cerrar() {
    document.querySelector('.card2').style.bottom = '-100vh';
    document.getElementById('nombre').value = '';
    document.getElementById('uso').value = '';
    document.getElementById('nota').value = '';
    document.getElementById('momento').value = 'mañana';
    document.querySelector('.form').style.maxHeight = 0;
}

function anadir() {
    document.querySelector('.form').style.maxHeight = '500px';
}

async function agregar() {
    const nombre = document.getElementById('nombre').value;
    const uso = document.getElementById('uso').value;
    const nota = document.getElementById('nota').value;
    const momento = document.getElementById('momento').value;
    
    if (!nombre) return alert("Nombre obligatorio");

    const nuevoMed = {
        id: Date.now(), 
        nombre: nombre,
        uso: uso,
        nota: nota,
        momento: momento,
        tomas: 0,
        ultima: ""
    };

    try {
        const db = await conectarDB();
        const tx = db.transaction(STORE_MEDS, "readwrite");
        const store = tx.objectStore(STORE_MEDS);
        store.add(nuevoMed);

        tx.oncomplete = () => {
            document.getElementById('nombre').value = '';
            document.getElementById('uso').value = '';
            document.getElementById('nota').value = '';
            document.getElementById('momento').value = 'mañana';
            document.querySelector('.form').style.maxHeight = 0;
            renderMeds();
        };
    } catch (err) {
        console.error("Error al agregar medicamento:", err);
    }
}

async function renderMeds() {
    document.querySelectorAll('.lista').forEach(l => l.innerHTML = '');
    
    try {
        const db = await conectarDB();
        const tx = db.transaction(STORE_MEDS, "readonly");
        const store = tx.objectStore(STORE_MEDS);
        const req = store.getAll();

        req.onsuccess = () => {
            const meds = req.result || [];

            meds.forEach(m => {
                const contenedor = document.querySelector(`#g-${m.momento} .lista`);
                if (!contenedor) return;

                const reciente = esReciente(m.ultima);

                const div = document.createElement('div');
                div.className = 'item';
                div.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        ${m.momento === 'sos' ? `
                        <div class="sos-controls">
                            <button class="btn-plus" onclick="registrarToma(${m.id})">+</button>
                            <span class="count-text">${m.tomas || 0} tomas</span>
                        </div>` : ''}
                        <div class="item-info">
                            <b>${m.nombre}</b>
                            <span class="uso">💊 ${m.uso || 'Sin uso'}</span>
                            <div class="hora-toma" style="width: 65vw ;display: flex; justify-content: space-between;">
                                <span style="color: ${reciente ? '#ff3b3b' : '#888'}; font-weight: ${reciente ? 'bold' : 'normal'}">
                                    ${m.ultima ? 'Última: ' + m.ultima : ''} ${reciente ? '⚠️' : ''}
                                </span>
                                <span style="color: ${reciente ? '#06c30e' : '#888'}; font-weight: ${reciente ? 'bold' : 'normal'}">
                                    ${m.ultima ? 'Próxima: ' + proxima(m.ultima) : ''} ${reciente ? '🕒' : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button class="btn-del" onclick="borrarMed(${m.id})">✕</button>
                `;
                contenedor.appendChild(div);
            });
        };
    } catch (err) {
        console.error("Error al renderizar medicamentos:", err);
    }
}

function proxima(horaString) {
    const [horas, minutos] = horaString.split(':');
    const ahora = new Date();
    const fechaEspecifica = new Date(
        ahora.getFullYear(),
        ahora.getMonth(),
        ahora.getDate(),
        parseInt(horas) + 8,
        minutos
    );
    return fechaEspecifica.getHours().toString().padStart(2, '0') + ':' + fechaEspecifica.getMinutes().toString().padStart(2, '0');
}

async function borrarMed(id) {
    if(confirm("¿Eliminar este medicamento definitivamente?")) {
        try {
            const db = await conectarDB();
            const tx = db.transaction(STORE_MEDS, "readwrite");
            const store = tx.objectStore(STORE_MEDS);
            store.delete(id);
            tx.oncomplete = () => renderMeds();
        } catch (err) {
            console.error("Error al borrar medicamento:", err);
        }
    }
}
// ==========================================
// 6. REGISTRO DE TOMAS SOS E HISTORIAL
// ==========================================

async function registrarToma(idRecibido) {
    try {
        const db = await conectarDB();
        
        // Buscamos la medicina de forma asíncrona
        const med = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_MEDS, "readonly");
            const store = tx.objectStore(STORE_MEDS);
            const req = store.get(Number(idRecibido));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (!med) return;

        const ahora = new Date();
        const horaTxt = ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0');
        
        // VALIDACIÓN DE SEGURIDAD (Mínimo 10 minutos entre tomas)
        if (med.ultima) {
            const difMinutos = obtenerMinutos(horaTxt) - obtenerMinutos(med.ultima);
            const diferenciaReal = difMinutos < 0 ? difMinutos + 1440 : difMinutos;
            
            if (diferenciaReal < 10) {
                 alert("Acción bloqueada. Por seguridad debes esperar al menos 10 minutos entre tomas del mismo medicamento.");
                 return; 
            }
        }

        // Operaciones de escritura coordinadas en una misma transacción
        const txGuardado = db.transaction([STORE_MEDS, STORE_TOMAS], "readwrite");
        const storeMeds = txGuardado.objectStore(STORE_MEDS);
        const storeTomas = txGuardado.objectStore(STORE_TOMAS);

        // Agregamos el registro al historial asíncrono
        storeTomas.add({ nombre: med.nombre, hora: horaTxt, timestamp: Date.now() });

        // Modificamos y actualizamos el contador en el medicamento
        med.tomas = (med.tomas || 0) + 1;
        med.ultima = horaTxt;
        storeMeds.put(med);

        txGuardado.oncomplete = async () => {
            if (navigator.vibrate) navigator.vibrate(50); 
            
            // Evaluamos y recortamos el historial asíncrono a un tope de 20 elementos
            await mitigarHistorialExcesivo();

            renderMeds();
            renderHistorial();
        };

    } catch (err) {
        console.error("Error al registrar la toma SOS:", err);
    }
}

// Función auxiliar encargada de mitigar el crecimiento desmedido del historial en DB
async function mitigarHistorialExcesivo() {
    const db = await conectarDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_TOMAS, "readwrite");
        const store = tx.objectStore(STORE_TOMAS);
        const req = store.getAll();
        
        req.onsuccess = () => {
            const registros = req.result || [];
            // Si supera las 20 tomas registradas en DB, eliminamos las sobrantes (las más antiguas)
            if (registros.length > 20) {
                const aBorrar = registros.length - 20;
                for (let i = 0; i < aBorrar; i++) {
                    store.delete(registros[i].id); 
                }
            }
            tx.oncomplete = () => resolve();
        };
    });
}

async function renderHistorial() {
    const log = document.getElementById('log-lista');
    if (!log) return;
    log.innerHTML = ""; 

    try {
        const db = await conectarDB();
        const tx = db.transaction(STORE_TOMAS, "readonly");
        const store = tx.objectStore(STORE_TOMAS);
        const req = store.getAll();

        req.onsuccess = () => {
            const historial = req.result || [];
            // Pintamos del más nuevo al más viejo
            [...historial].reverse().forEach(entry => {
                const div = document.createElement('div');
                div.className = 'log-item2';
                div.innerHTML = `<span><b>${entry.nombre}</b></span> <span>${entry.hora}</span>`;
                log.appendChild(div);
            });
        };
    } catch (err) {
        console.error("Error al renderizar el historial de tomas:", err);
    }
}

async function reiniciarContadores() {
    const confirmar1 = confirm("¿Quieres poner a cero todos los contadores?");
    if (!confirmar1) return;
    
    const confirmar2 = confirm("ESTO BORRARÁ TAMBIÉN EL HISTORIAL. ¿Estás seguro?");
    if (!confirmar2) return;

    try {
        const db = await conectarDB();
        const tx = db.transaction([STORE_MEDS, STORE_TOMAS], "readwrite");
        
        // 1. Limpiamos historial completo en DB
        tx.objectStore(STORE_TOMAS).clear();

        // 2. Reseteamos a cero las propiedades internas de las medicinas
        const storeMeds = tx.objectStore(STORE_MEDS);
        const req = storeMeds.getAll();

        req.onsuccess = () => {
            const meds = req.result || [];
            meds.forEach(m => {
                m.tomas = 0;
                m.ultima = "";
                storeMeds.put(m);
            });
        };

        tx.oncomplete = () => {
            renderMeds();
            renderHistorial();
            alert("Datos reiniciados correctamente.");
        };
    } catch (err) {
        console.error("Error al reiniciar contadores globales:", err);
    }
}

function mostrar() {
    document.querySelector('.card2').style.bottom = 0;
}

// ==========================================
// 7. REGISTRO DEL SERVICE WORKER
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker activado con éxito."))
    .catch(err => console.error("Fallo al registrar SW:", err));
}





// después de la migración
// Así de limpio quedará tu initApp() en el futuro cuando elimines la migración:
/*async function initApp() {
    try {
        // Solo abrimos la conexión para comprobar que IndexedDB responde
        await conectarDB();

        // Renderizado inicial directo desde la base de datos
        setNow();
        render();
        renderMeds();
        renderHistorial();
    } catch (err) {
        console.error("Error al inicializar la base de datos:", err);
        render();
        renderMeds();
        renderHistorial();
    }
	
	// Solicitar que IndexedDB sea persistente y no se borre automáticamente
	if (navigator.storage && navigator.storage.persist) {
		navigator.storage.persist().then(granted => {
			if (granted) {
				console.log("¡Excelente! Almacenamiento marcado como PERSISTENTE. Datos protegidos.");
			} else {
				console.log("El navegador denegó la persistencia (es normal si la app no está instalada aún).");
			}
		});
	}
}*/
