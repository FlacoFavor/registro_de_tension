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
		if (dif < 0) dif += 1440; // Corrección si la toma fue ayer antes de medianoche
		return dif < 240; // Menos de 4 horas (240 min)
	}

    // Función para poner fecha y hora actual
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

    function add() {
        const s = parseInt(document.getElementById('s').value), 
              d = parseInt(document.getElementById('d').value), 
              p = parseInt(document.getElementById('p').value), 
              n = document.getElementById('n').value,
              f = document.getElementById('f').value,
              h = document.getElementById('h').value;

        if(!s || !d || !p) return;

        let logs = JSON.parse(localStorage.getItem('health_final_v1') || '[]');
        logs.push({ id: Date.now(), f, h, s, d, p, n });
        logs.sort((a,b) => new Date(a.f+'T'+a.h) - new Date(b.f+'T'+b.h));
        localStorage.setItem('health_final_v1', JSON.stringify(logs));
        
        ['s','d','p','n'].forEach(id => document.getElementById(id).value = '');
        setNow(); // Actualiza a la hora del siguiente registro
        render();
    }

    function render() {
        const logs = JSON.parse(localStorage.getItem('health_final_v1') || '[]');
        const container = document.getElementById('log-list');
        container.innerHTML = ''; 

        [...logs].reverse().forEach(r => {
            const st = getStatus(r.s, r.d);
            const dateShort = r.f.split('-').slice(1).reverse().join('/');
            container.innerHTML += `
				<div>
                <div class="log-item">
                    <span class="col-time">${dateShort} ${r.h}</span>
                    <span class="col-data">${r.s}/${r.d}<span class="col-pul">${r.p}</span></span>
                    <span class="col-note"></span>
                    <span class="badge ${st.class}">${st.label}</span>
                    <span style="color:#def; cursor:pointer; display: inline-block; text-align: center; font-weight: bold;width: 1.5rem; height: 1.5rem; line-height: 1; font-size: 150%; border-radius: 100%; background-color: #ab2c2c;
" onclick="del(${r.id})">×</span>
                </div>
				${ r.n ? `<span class="col-note">${r.n}</span>` : '' }
				
				</div>`;
        });
    };
    function del(id) {
        if(confirm("¿Borrar?")) {
            let l = JSON.parse(localStorage.getItem('health_final_v1')).filter(r => r.id !== id);
            localStorage.setItem('health_final_v1', JSON.stringify(l)); render();
        }
    }

    function clearAll() { if(confirm("¿Reset total?")) { localStorage.removeItem('health_final_v1'); render(); }}

    function exportCSV() {
    const logs = JSON.parse(localStorage.getItem('health_final_v1') || '[]');
    if (logs.length === 0) return alert("No hay datos para exportar.");

    // Añadimos comillas "" a la Nota por si el usuario escribió un ";" dentro.
    let csv = "Fecha;Hora;Sistolica;Diastolica;Pulso;Nota\n";
    logs.forEach(r => {
        csv += `${r.f};${r.h};${r.s};${r.d};${r.p};"${r.n || ''}"\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Nombre de archivo: salud_DD-MM-YYYY.csv
    a.download = `salud_${new Date().toISOString().slice(0,10).split('-').reverse().join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url); // Liberar memoria
}

	function importCSV() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.csv';

		input.onchange = e => {
			const file = e.target.files[0];
			const reader = new FileReader();

			reader.onload = event => {
				try {
					const lines = event.target.result.split('\n').filter(line => line.trim() !== "");
					const rows = lines.slice(1); // Ignorar cabecera

					const importedLogs = rows.map((line, index) => {
						// Separamos y limpiamos comillas de las notas
						let [f, h, s, d, p, n] = line.split(';').map(v => v.replace(/^"|"$/g, ''));
						
						return { 
							id: Date.now() + index, // IMPORTANTE: Generar ID para que funcione el botón borrar
							f, h, 
							s: parseInt(s), 
							d: parseInt(d), 
							p: parseInt(p), 
							n: n || "" 
						};
					});

						// texto al unirlos - ¿Deseas sumarlos a tus datos actuales?
					if (confirm(`Se han encontrado ${importedLogs.length} registros. ¿Deseas importarlos?`)) {
						const currentLogs = JSON.parse(localStorage.getItem('health_final_v1') || '[]');
/*
						// Unimos, ordenamos por fecha/hora y guardamos
						const totalLogs = [...currentLogs, ...importedLogs];
						totalLogs.sort((a,b) => new Date(a.f+'T'+a.h) - new Date(b.f+'T'+b.h));
*/
						// para unirlos cambiar importedLogs por totalLogs
						localStorage.setItem('health_final_v1', JSON.stringify(importedLogs));
						alert("Importación completada con éxito.");
						render(); // Actualiza la lista sin recargar toda la página
					}
				} catch (err) {
					alert("Error: El formato del archivo no es válido.");
				}
			};
			reader.readAsText(file, "UTF-8");
		};
		input.click();
	};
	
// ----------

	function mostrar() {
		document.querySelector('.card2').style.bottom = 0;
	};
	function cerrar() {
		document.querySelector('.card2').style.bottom = '-100vh';
		document.getElementById('nombre').value = '';
        document.getElementById('uso').value = '';
        document.getElementById('nota').value = '';
		document.getElementById('momento').value = 'mañana';
		document.querySelector('.form').style.maxHeight = 0;
	};
	function anadir() {
		document.querySelector('.form').style.maxHeight = '500px';
	};
	
	function agregar() {
		const nombre = document.getElementById('nombre').value;
		const uso = document.getElementById('uso').value;
		const nota = document.getElementById('nota').value;
		const momento = document.getElementById('momento').value;
		
		if (!nombre) return alert("Nombre obligatorio");

		const nuevoMed = {
			id: Date.now(), // Genera un ID único basado en el tiempo
			nombre: nombre,
			uso: uso,
			nota: nota,
			momento: momento,
			tomas: 0,
			ultima: ""
		};

		let meds = JSON.parse(localStorage.getItem('meds_v1') || '[]');
		meds.push(nuevoMed);
		localStorage.setItem('meds_v1', JSON.stringify(meds));

		// Limpiar campos y cerrar
		document.getElementById('nombre').value = '';
		document.getElementById('uso').value = '';
		document.getElementById('nota').value = '';
		document.getElementById('momento').value = 'mañana';
		document.querySelector('.form').style.maxHeight = 0;

		renderMeds();
	};
	
	function renderMeds() {
		document.querySelectorAll('.lista').forEach(l => l.innerHTML = '');
		const meds = JSON.parse(localStorage.getItem('meds_v1') || '[]');

		meds.forEach(m => {
			const contenedor = document.querySelector(`#g-${m.momento} .lista`);
			if (!contenedor) return;

			// Comprobamos si la toma fue hace menos de 4 horas
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
						<!-- AQUÍ EL CAMBIO DE COLOR -->
						<span class="hora-toma" style="color: ${reciente ? '#ff3b3b' : '#888'}; font-weight: ${reciente ? 'bold' : 'normal'}">
							${m.ultima ? 'Última: ' + m.ultima : ''} ${reciente ? '⚠️' : ''}
						</span>
					</div>
				</div>
				<button class="btn-del" onclick="borrarMed(${m.id})">✕</button>
			`;
			contenedor.appendChild(div);
		});
	};

	// Función para borrar físicamente del Storage
	function borrarMed(id) {
		if(confirm("¿Eliminar este medicamento definitivamente?")) {
			let meds = JSON.parse(localStorage.getItem('meds_v1') || '[]');
			meds = meds.filter(m => m.id !== id);
			localStorage.setItem('meds_v1', JSON.stringify(meds));
			renderMeds();
		}
	};


	
	function registrarToma(idRecibido) {
		let meds = JSON.parse(localStorage.getItem('meds_v1') || '[]');
		const idx = meds.findIndex(m => Number(m.id) === Number(idRecibido));

		if (idx !== -1) {
			const ahora = new Date();
			// Formato limpio HH:MM (ejemplo 08:05)
			const horaTxt = ahora.getHours().toString().padStart(2, '0') + ':' +  ahora.getMinutes().toString().padStart(2, '0');
			
			let historial = JSON.parse(localStorage.getItem('tomas_v1') || '[]');
			historial.unshift({ nombre: meds[idx].nombre, hora: horaTxt }); // Añade al inicio
			if (historial.length > 20) historial.pop(); // Limita a 20 registros
			localStorage.setItem('tomas_v1', JSON.stringify(historial));

			// Bloqueo de seguridad 10 min
			if (meds[idx].ultima && (obtenerMinutos(horaTxt) - obtenerMinutos(meds[idx].ultima)) < 10) {
				 alert("Espera 10 min entre tomas.");
				 return;
			}

			meds[idx].tomas = (meds[idx].tomas || 0) + 1;
			meds[idx].ultima = horaTxt;

			localStorage.setItem('meds_v1', JSON.stringify(meds));
			if (navigator.vibrate) navigator.vibrate(50); // Vibración corta de 50ms
			renderMeds();
			renderHistorial();
		}
	};
	
	function renderHistorial() {
		const historial = JSON.parse(localStorage.getItem('tomas_v1') || '[]');
		const log = document.getElementById('log-lista');
		if (!log) return;

		log.innerHTML = ""; // Limpiar antes de dibujar
		historial.forEach(entry => {
			const div = document.createElement('div');
			div.className = 'log-item2';
			div.innerHTML = `<span><b>${entry.nombre}</b></span> <span>${entry.hora}</span>`;
			log.appendChild(div);
		});
	};


    function reiniciarContadores() {
		// 1. Doble confirmación de seguridad
		const confirmar1 = confirm("¿Quieres poner a cero todos los contadores?");
		if (!confirmar1) return;
		
		const confirmar2 = confirm("ESTO BORRARÁ TAMBIÉN EL HISTORIAL. ¿Estás seguro?");
		if (!confirmar2) return;

		// 2. Limpiar el historial del Storage
		localStorage.removeItem('tomas_v1');

		// 3. Resetear contadores en la lista de medicamentos
		let meds = JSON.parse(localStorage.getItem('meds_v1') || '[]');
		
		// Recorremos cada medicina y limpiamos sus datos de toma
		const medsReseteados = meds.map(m => {
			return {
				...m,
				tomas: 0,    // Volver a cero
				ultima: ""   // Quitar la última hora
			};
		});

		// 4. Guardar la lista limpia en Storage
		localStorage.setItem('meds_v1', JSON.stringify(medsReseteados));

		// 5. Actualizar la interfaz completa
		renderMeds();
		renderHistorial();
		
		// Feedback visual opcional
		alert("Datos reiniciados correctamente.");
	};
	
	// Al final del script
	setNow();
	render();      // Tus registros de tensión
	renderMeds();  // Tus medicamentos guardados
	renderHistorial(); // Historial de tomas SOS


	// Registro del Service Worker para que sea instalable
	  if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('sw.js');
	  }