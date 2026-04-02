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

		// 1. Agrupar registros por "Mes Año"
		const groups = {};
		const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

		// Invertimos el orden para que lo más reciente aparezca arriba
		[...logs].reverse().forEach(r => {
			const dateObj = new Date(r.f + 'T' + r.h);
			const groupKey = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
			
			if (!groups[groupKey]) groups[groupKey] = [];
			groups[groupKey].push(r);
		});

		// 2. Dibujar los grupos y sus registros
		for (const monthYear in groups) {
			// Añadir cabecera del mes
			container.innerHTML += `<div class="month-header" style="background:#456; color:#fff; padding:5px 10px; margin:15px 0 5px; border-radius:4px; font-size:0.9rem; font-weight:bold;">${monthYear}</div>`;

			groups[monthYear].forEach(r => {
				const st = getStatus(r.s, r.d);
				const dateShort = r.f.split('-').reverse().slice(0, 1); // Solo el día si ya tenemos el mes arriba
				
				container.innerHTML += `
					<div style="margin-bottom: 8px;">
						<div class="log-item">
							<span class="col-time">${r.f.split('-')[2]} - ${r.h}</span>
							<span class="col-data">${r.s}/${r.d}<span class="col-pul">${r.p}</span></span>
							<span class="col-note"></span>
							<span class="badge ${st.class}">${st.label}</span>
							<span onclick="del(${r.id})" style="color:#def; cursor:pointer; display: inline-block; text-align: center; font-weight: bold; width: 1.5rem; height: 1.5rem; line-height: 1; font-size: 150%; border-radius: 100%; background-color: #ab2c2c;">×</span>
						</div>
						${ r.n ? `<div class="col-note" style="font-size:0.85rem; color:#aaa; margin-left:10px;">${r.n}</div>` : '' }
					</div>`;
			});
		}
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
        let csv = "Fecha;Hora;Sistolica;Diastolica;Pulso;Nota\n";
        logs.forEach(r => csv += `${r.f};${r.h};${r.s};${r.d};${r.p};${r.n}\n`);
        const blob = new Blob(["\ufeff" + csv], { type: 'text/csv' });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `salud_hoy.csv`; a.click();
    }
	
	// Registro del Service Worker para que sea instalable
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

    setNow();
    render();
