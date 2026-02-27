// Versión corregida v1.1 - 2026-02-27
const SUPABASE_URL = 'https://rxrodfskmvldozpznyrp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rm-U3aeXydu4W0wdSMLW5w_I4LIW5MO';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const tableContainer = document.getElementById('vehicles-table');
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('no-data');
    const loadingState = document.getElementById('loading');
    const uploadInputProAuto = document.getElementById('excel-upload-proauto');
    const uploadInputColor = document.getElementById('excel-upload-color');
    const printEncargado = document.getElementById('print-encargado');
    const printBtn = document.getElementById('print-btn');
    const printNormalBtn = document.getElementById('print-normal-btn');
    const addEncargadoBtn = document.getElementById('add-encargado-btn');
    const filterControls = document.getElementById('filter-controls');
    const dateCheckboxes = document.querySelectorAll('.date-filter-cb');
    const btnSaveState = document.getElementById('btn-save-state');
    const btnLoadCloud = document.getElementById('btn-load-cloud');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const originTabsContainer = document.getElementById('origin-tabs');
    const statsSummary = document.getElementById('stats-summary');

    // Checklist elements
    const chkStep1 = document.getElementById('chk-step-1');
    const chkStep2 = document.getElementById('chk-step-2');
    const chkStep3 = document.getElementById('chk-step-3');
    const chkStep4 = document.getElementById('chk-step-4');
    const chkStep5 = document.getElementById('chk-step-5');

    let customEncargados = [];
    let savedVehicles = {}; // { ot: { data } }
    let currentData = null;
    let activeOriginTab = 'PROAUTO';
    let uploadedOrigins = new Set();

    // 1. Cargar datos iniciales de Supabase
    async function initSupabaseData() {
        loadingState.classList.remove('hidden');
        // Cargar encargados
        const { data: encData } = await _supabase.from('configuracion_encargados').select('nombre');
        if (encData) customEncargados = encData.map(e => e.nombre);

        // Cargar vehículos guardados
        const { data: vehData } = await _supabase.from('seguimiento_vehiculos').select('*').order('ultima_actualizacion', { ascending: false });
        if (vehData) {
            vehData.forEach(v => {
                savedVehicles[v.ot] = {
                    ot: v.ot,
                    encargado: v.encargado,
                    enTaller: v.en_taller,
                    fechaSeguimiento: v.fecha_seguimiento,
                    listo: v.listo,
                    appearances: v.asteriscos,
                    observacion: v.observacion || '',
                    origen: v.origen || 'PROAUTO',
                    placa: v.placa || '',
                    vehiculo: v.vehiculo || '',
                    cliente: v.cliente || '',
                    costo: v.costo || '',
                    fecha_orden: v.fecha_orden || '',
                    lastUpload: v.ultima_actualizacion ? new Date(v.ultima_actualizacion).toLocaleDateString('en-CA') : ''
                };
            });
        }
        loadingState.classList.add('hidden');
    }

    await initSupabaseData();

    // Lógica para cambio de pestañas (Tabs)
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeOriginTab = btn.dataset.origin;
            if (currentData) {
                renderTable(currentData);
                applyFilters();
            }
        });
    });

    // Botón para ver datos de la nube sin archivo
    btnLoadCloud.addEventListener('click', async () => {
        await initSupabaseData(); // Refrescar datos

        if (Object.keys(savedVehicles).length === 0) {
            alert('No hay datos guardados en la nube aún.');
            return;
        }

        // Convertir savedVehicles a un formato compatible con renderTable
        const cloudData = [{}]; // Fila vacía para simular el header del Excel
        Object.values(savedVehicles).forEach(v => {
            if (v.enTaller === 'NO') return; // Saltar los que ya fueron operados y sacados

            cloudData.push({
                'B': v.ot,
                'G': v.encargado,
                'D': v.fecha_orden || '',
                'V': v.enTaller === 'NO' ? 'FINALIZADO' : 'PENDIENTE',
                '_isCloudOnly': true,
                '_origen': v.origen || 'PROAUTO',
                ...v
            });
        });

        currentData = cloudData;
        renderTable(cloudData);

        emptyState.classList.add('hidden');
        tableContainer.classList.remove('hidden');
        filterControls.classList.remove('hidden');
        originTabsContainer.classList.remove('hidden');
        statsSummary.classList.remove('hidden');
        document.querySelectorAll('.print-controls, #action-guardar').forEach(el => el.classList.remove('hidden'));
        applyFilters();
    });

    // Manejar filtro de fechas y encargado
    dateCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
    printEncargado.addEventListener('change', applyFilters);

    function applyFilters() {
        const showHoyVencidas = document.querySelector('.date-filter-cb[value="hoy_vencidas"]').checked;
        const showFuturas = document.querySelector('.date-filter-cb[value="futuras"]').checked;
        const showSinFecha = document.querySelector('.date-filter-cb[value="sin_fecha"]').checked;
        const selectedEncargado = printEncargado.value;

        const allRows = tableBody.querySelectorAll('tr');
        const todayStr = new Date().toLocaleDateString('en-CA');

        allRows.forEach(row => {
            if (row.classList.contains('separator-row')) return;

            const inputDateEle = row.querySelector('.fecha-seg-input');
            const inputDate = inputDateEle ? inputDateEle.value : '';
            const rowEncargado = row.dataset.encargado || '';

            let dateMatch = false;
            if (!inputDate) {
                if (showSinFecha) dateMatch = true;
            } else {
                if (inputDate <= todayStr && showHoyVencidas) dateMatch = true;
                else if (inputDate > todayStr && showFuturas) dateMatch = true;
            }

            let encargadoMatch = true;
            if (selectedEncargado !== '') {
                encargadoMatch = rowEncargado === selectedEncargado;
            }

            if (dateMatch && encargadoMatch) row.classList.remove('hidden');
            else row.classList.add('hidden');
        });

        // Cleanup empty separators
        let currentSectorHeader = null;
        let sectorHasRows = false;
        allRows.forEach(row => {
            if (row.classList.contains('separator-row')) {
                if (currentSectorHeader && !sectorHasRows) currentSectorHeader.classList.add('hidden');
                currentSectorHeader = row;
                sectorHasRows = false;
                row.classList.remove('hidden');
            } else if (!row.classList.contains('hidden')) {
                sectorHasRows = true;
            }
        });
        if (currentSectorHeader && !sectorHasRows) currentSectorHeader.classList.add('hidden');
    }

    // Añadir encargado manual
    addEncargadoBtn.addEventListener('click', async () => {
        const nuevoName = prompt("Ingresa el nombre del nuevo mecánico o encargado:");
        if (nuevoName && nuevoName.trim() !== '') {
            const cleanName = nuevoName.trim().toUpperCase();
            if (!customEncargados.includes(cleanName)) {
                const { error } = await _supabase.from('configuracion_encargados').insert([{ nombre: cleanName }]);
                if (!error) {
                    customEncargados.push(cleanName);
                    if (currentData) {
                        renderTable(currentData);
                        applyFilters();
                    }
                    alert(`¡Encargado "${cleanName}" añadido con éxito!`);
                }
            } else {
                alert("Ese encargado ya existe en la lista.");
            }
        }
    });

    // Imprimir
    printNormalBtn.addEventListener('click', () => {
        if (chkStep3) chkStep3.checked = true;
        document.body.classList.add('print-bw-compact');
        setTimeout(() => {
            window.print();
            window.addEventListener('afterprint', () => document.body.classList.remove('print-bw-compact'), { once: true });
            setTimeout(() => document.body.classList.remove('print-bw-compact'), 3000);
        }, 100);
    });

    printBtn.addEventListener('click', () => {
        const selectedEncargado = printEncargado.value;
        const allRows = tableBody.querySelectorAll('tr');
        if (!selectedEncargado) {
            alert('Por favor selecciona un encargado.');
            return;
        }

        allRows.forEach(row => {
            if (!row.classList.contains('separator-row') && row.dataset.encargado !== selectedEncargado) {
                row.classList.add('hidden-print');
            } else {
                row.classList.remove('hidden-print');
            }
        });

        if (chkStep4) chkStep4.checked = true;
        document.body.classList.add('print-bw-compact');
        setTimeout(() => {
            window.print();
            window.addEventListener('afterprint', () => {
                document.body.classList.remove('print-bw-compact');
                allRows.forEach(row => row.classList.remove('hidden-print'));
            }, { once: true });
        }, 100);
    });

    // Subida de Excel
    function handleExcelUpload(e, isColorCenter) {
        const file = e.target.files[0];
        if (!file) return;

        emptyState.classList.add('hidden');
        tableContainer.classList.add('hidden');
        filterControls.classList.add('hidden');
        loadingState.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A", defval: "" });

                const rowsWithOrigin = jsonData.slice(1).map(row => ({ ...row, _origen: isColorCenter ? 'COLOR_CENTER' : 'PROAUTO' }));

                if (!currentData) {
                    currentData = [{ A: 'Header Placeholder' }];
                }

                // Filtrar currentData para remover filas del mismo origen que se está subiendo para "actualizar"
                currentData = currentData.filter(row => !row._origen || row._origen !== (isColorCenter ? 'COLOR_CENTER' : 'PROAUTO'));
                currentData = currentData.concat(rowsWithOrigin);

                if (isColorCenter) {
                    uploadedOrigins.add('COLOR_CENTER');
                    activeOriginTab = 'COLOR_CENTER';
                    tabBtns[0].classList.remove('active');
                    tabBtns[1].classList.add('active');
                } else {
                    uploadedOrigins.add('PROAUTO');
                    activeOriginTab = 'PROAUTO';
                    tabBtns[0].classList.add('active');
                    tabBtns[1].classList.remove('active');
                }

                renderTable(currentData);
                loadingState.classList.add('hidden');
                tableContainer.classList.remove('hidden');
                originTabsContainer.classList.remove('hidden');
                statsSummary.classList.remove('hidden');
                document.querySelectorAll('.print-controls, #action-guardar, #filter-controls, #btn-save-state').forEach(el => el.classList.remove('hidden'));

                applyFilters();
                if (isColorCenter) { if (chkStep2) chkStep2.checked = true; }
                else { if (chkStep1) chkStep1.checked = true; }
            } catch (error) {
                alert("Error: " + error.message);
                loadingState.classList.add('hidden');
                emptyState.classList.remove('hidden');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    uploadInputProAuto.addEventListener('change', (e) => handleExcelUpload(e, false));
    uploadInputColor.addEventListener('change', (e) => handleExcelUpload(e, true));

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (!data || data.length < 2) return;

        const rows = data.slice(1);
        const uniqueOrders = new Map();
        rows.forEach(row => {
            const ot = row['B'] || row.ot;
            if (!ot || String(ot).trim() === '') return;
            if (!uniqueOrders.has(ot)) uniqueOrders.set(ot, row);
        });

        let arrayOrders = Array.from(uniqueOrders.values());
        const uniqueEncargadosSet = new Set(customEncargados);
        const hoy = new Date();
        const todayStr = hoy.toLocaleDateString('en-CA');
        hoy.setHours(0, 0, 0, 0);

        arrayOrders.forEach(row => {
            const ot = row['B'] || row.ot;
            const e = row['G'] || row.encargado || '';
            if (e.trim()) uniqueEncargadosSet.add(e.trim());

            let prevData = savedVehicles[ot];
            let asterisks = '';

            if (prevData) {
                let apps = prevData.appearances || 0;
                let isListo = prevData.listo || false;

                if (!row._isCloudOnly && prevData.lastUpload && prevData.lastUpload !== todayStr) {
                    apps += 1;
                    isListo = false;
                }

                row['G'] = prevData.encargado || row['G'] || row.encargado || '';
                row._savedEnTaller = prevData.enTaller;
                row._savedFechaSeg = prevData.fechaSeguimiento;
                row._savedObservacion = prevData.observacion;
                row._origen = row._origen || prevData.origen || 'PROAUTO';
                row._listo = isListo;
                row._asterisks = '*'.repeat(Math.min(apps, 3));
                row._apps = apps;
            } else {
                row._listo = false;
                row._apps = 0;
                row._asterisks = '';
                row._origen = row._origen || 'PROAUTO';
            }

            // Categoría
            const fechaCol = row['D'] || row.fecha_orden || '';
            let categoryId = 7;
            let categoryName = 'Otras órdenes';
            if (fechaCol && fechaCol.includes('-')) {
                const parts = fechaCol.split(' ')[0].split('-');
                if (parts.length === 3) {
                    const d = new Date(parts[0], parts[1] - 1, parts[2]);
                    const diff = Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
                    if (diff <= 7) { categoryId = 1; categoryName = '1. Esta semana'; }
                    else if (diff <= 14) { categoryId = 2; categoryName = '2. Semana pasada'; }
                    else if (diff <= 21) { categoryId = 3; categoryName = '3. Hace 3 semanas'; }
                    else if (diff <= 60) { categoryId = 4; categoryName = '4. Hace más de 1 mes'; }
                    else if (diff <= 90) { categoryId = 5; categoryName = '5. Hace más de 2 meses'; }
                    else { categoryId = 6; categoryName = '6. De 3 meses para atrás'; }
                }
            }
            row._categoryId = categoryId;
            row._categoryName = categoryName;
        });

        const listEncargados = Array.from(uniqueEncargadosSet).sort();
        printEncargado.innerHTML = '<option value="">Todos los Encargados</option>' + listEncargados.map(enc => `<option value="${enc}">${enc}</option>`).join('');

        // Filtrar solo los datos que corresponden a la pestaña activa para mostrar en la UI
        const filteredToRender = arrayOrders.filter(row => row._origen === activeOriginTab);

        renderStats(filteredToRender);

        // Ordenar: 1. Categoría, 2. Encargado
        filteredToRender.sort((a, b) => {
            if (a._categoryId !== b._categoryId) {
                return a._categoryId - b._categoryId;
            }
            return (a['G'] || a.encargado || '').localeCompare(b['G'] || b.encargado || '');
        });

        let currentCategory = null;
        let globalCounter = 1;

        filteredToRender.forEach(row => {

            if (row._categoryName !== currentCategory) {
                currentCategory = row._categoryName;
                const trSep = document.createElement('tr');
                trSep.className = 'separator-row';
                trSep.innerHTML = `<td colspan="12">${currentCategory}</td>`;
                tableBody.appendChild(trSep);
            }

            const tr = document.createElement('tr');
            if (row._listo) tr.classList.add('row-tachada');
            const ot = row['B'] || row.ot;
            tr.dataset.encargado = row['G'] || row.encargado || 'Sin Asignar';
            tr.dataset.ot = ot;

            // Checkbox Listo
            const tdListo = document.createElement('td');
            tdListo.style.textAlign = 'center';
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = row._listo;
            chk.addEventListener('change', (e) => {
                if (e.target.checked) tr.classList.add('row-tachada');
                else tr.classList.remove('row-tachada');
                updateVehicleField(ot, 'listo', e.target.checked, row._origen);
            });
            tdListo.appendChild(chk);
            tr.appendChild(tdListo);

            tr.appendChild(createCell(globalCounter++));
            tr.appendChild(createCell(`${ot}${row._asterisks || ''}`));

            // Quitar la hora de la fecha (ej. "2026-02-12 02:31:25 PM" -> "2026-02-12")
            let rawStrDate = row['D'] || row.fecha_orden || '';
            let dateOnly = rawStrDate.includes(' ') ? rawStrDate.split(' ')[0] : rawStrDate;
            tr.appendChild(createCell(dateOnly));

            // Encargado Select
            const tdEnc = document.createElement('td');
            const selEnc = document.createElement('select');
            selEnc.className = 'status-select';
            listEncargados.forEach(enc => {
                const opt = document.createElement('option');
                opt.value = enc; opt.textContent = enc;
                if (enc === (row['G'] || row.encargado)) opt.selected = true;
                selEnc.appendChild(opt);
            });
            selEnc.addEventListener('change', (e) => {
                tr.dataset.encargado = e.target.value;
                updateVehicleField(ot, 'encargado', e.target.value, row._origen);
            });
            tdEnc.appendChild(selEnc);
            tr.appendChild(tdEnc);

            let valPlaca = row._isCloudOnly ? (row.placa || '') : (row['H'] || row.placa || '');
            tr.appendChild(createCell(valPlaca));

            let valVehiculo = row._isCloudOnly ? (row.vehiculo || '---') : `${row['K'] || ''} ${row['L'] || ''}`.trim();
            if (!valVehiculo) valVehiculo = row.vehiculo || '---';
            tr.appendChild(createCell(valVehiculo));

            let valCliente = row._isCloudOnly ? (row.cliente || '') : (row['T'] || row.cliente || '');
            tr.appendChild(createCell(valCliente));

            // En Taller Select
            const tdTaller = document.createElement('td');
            const selTaller = document.createElement('select');
            selTaller.className = 'status-select';
            const enTaller = row._savedEnTaller || 'REVISAR';
            ['REVISAR', 'SI', 'NO'].forEach(optStr => {
                const opt = document.createElement('option');
                opt.value = optStr; opt.textContent = optStr;
                if (optStr === enTaller) opt.selected = true;
                selTaller.appendChild(opt);
            });
            selTaller.addEventListener('change', (e) => {
                tr.classList.remove('row-green', 'row-white', 'row-yellow');
                if (e.target.value === 'SI') tr.classList.add('row-green');
                else if (e.target.value === 'NO') tr.classList.add('row-white');
                else tr.classList.add('row-yellow');
                updateVehicleField(ot, 'en_taller', e.target.value, row._origen);
            });
            tdTaller.appendChild(selTaller);
            tr.appendChild(tdTaller);

            if (enTaller === 'SI') tr.classList.add('row-green');
            else if (enTaller === 'NO') tr.classList.add('row-white');
            else tr.classList.add('row-yellow');

            let valCosto = row._isCloudOnly ? (row.costo || '0.00') : (row['AO'] || row.costo || '0.00');
            const tdCosto = createCell('Q.' + valCosto);
            tdCosto.className = 'col-costo';
            tr.appendChild(tdCosto);

            const tdObs = document.createElement('td');
            const inObs = document.createElement('input');
            inObs.type = 'text'; inObs.className = 'status-select';
            inObs.placeholder = 'Observación...';
            inObs.value = row._savedObservacion || '';
            inObs.addEventListener('change', (e) => {
                updateVehicleField(ot, 'observacion', e.target.value, row._origen);
            });
            tdObs.appendChild(inObs);
            tr.appendChild(tdObs);

            const tdFecha = document.createElement('td');
            const inFecha = document.createElement('input');
            inFecha.type = 'date'; inFecha.className = 'status-select fecha-seg-input';
            inFecha.value = row._savedFechaSeg || '';
            inFecha.addEventListener('change', (e) => {
                updateVehicleField(ot, 'fecha_seguimiento', e.target.value, row._origen);
                applyFilters();
            });
            tdFecha.appendChild(inFecha);
            tr.appendChild(tdFecha);

            tableBody.appendChild(tr);
        });

        btnSaveState.onclick = async function () {
            // Guardar o actualizar TODOS los vehículos cargados (independientemente de la pestaña)
            let updates = arrayOrders.map(row => ({
                ot: row['B'] || row.ot,
                encargado: row['G'] || row.encargado,
                en_taller: row._savedEnTaller || 'REVISAR',
                fecha_seguimiento: row._savedFechaSeg || '',
                listo: row._listo || false,
                asteriscos: row._apps || 0,
                observacion: row._savedObservacion || '',
                origen: row._origen || 'PROAUTO',
                placa: row._isCloudOnly ? (row.placa || '') : (row['H'] || row.placa || ''),
                vehiculo: row._isCloudOnly ? (row.vehiculo || '') : `${row['K'] || ''} ${row['L'] || ''}`.trim() || row.vehiculo || '',
                cliente: row._isCloudOnly ? (row.cliente || '') : (row['T'] || row.cliente || ''),
                costo: row._isCloudOnly ? (row.costo || '0.00') : (row['AO'] || row.costo || '0.00'),
                fecha_orden: row._isCloudOnly ? (row.fecha_orden || '') : (row['D'] || row.fecha_orden || ''),
                ultima_actualizacion: new Date().toISOString()
            }));

            // AUTO-LIMPIEZA: identificar vehículos que estaban en la nube pero ya no están en los archivos subidos
            // (esto significa que ya fueron operados/sacados del sistema)
            Object.values(savedVehicles).forEach(sv => {
                const alreadyIncluded = updates.some(u => String(u.ot).trim() === String(sv.ot).trim());
                // Si la sucursal fue cargada hoy, pero este vehículo no vino en el reporte, lo marcamos como 'NO' en taller
                if (uploadedOrigins.has(sv.origen) && !alreadyIncluded && sv.enTaller !== 'NO') {
                    updates.push({
                        ot: sv.ot,
                        encargado: sv.encargado,
                        en_taller: 'NO',
                        fecha_seguimiento: sv.fechaSeguimiento,
                        listo: sv.listo,
                        asteriscos: sv.appearances,
                        observacion: sv.observacion,
                        origen: sv.origen,
                        placa: sv.placa,
                        vehiculo: sv.vehiculo,
                        cliente: sv.cliente,
                        costo: sv.costo,
                        fecha_orden: sv.fecha_orden,
                        ultima_actualizacion: new Date().toISOString()
                    });
                }
            });

            const { error } = await _supabase.from('seguimiento_vehiculos').upsert(updates);
            if (!error) {
                if (chkStep5) chkStep5.checked = true;
                alert('¡Sincronización con Supabase completa!');
            } else {
                alert('Error al sincronizar: ' + error.message);
            }
        };
    }

    async function updateVehicleField(ot, field, value, origin) {
        const update = { ot, [field]: value, origen: origin, ultima_actualizacion: new Date().toISOString() };
        await _supabase.from('seguimiento_vehiculos').upsert([update]);
    }

    function createCell(text) {
        const td = document.createElement('td');
        td.textContent = text;
        return td;
    }

    function renderStats(filteredData) {
        statsSummary.innerHTML = '';
        const counts = {};

        // Solo contar vehículos que están actualmente en taller (SI)
        filteredData.forEach(row => {
            const status = row._savedEnTaller || 'REVISAR';
            if (status === 'SI') {
                const enc = (row['G'] || row.encargado || 'SIN ASIGNAR').toUpperCase();
                counts[enc] = (counts[enc] || 0) + 1;
            }
        });

        const sortedEncargados = Object.keys(counts).sort();
        let totalVehicles = 0;
        Object.values(counts).forEach(count => totalVehicles += count);

        if (totalVehicles === 0 && sortedEncargados.length === 0) {
            statsSummary.innerHTML = '<p style="font-size: 0.9rem; color: var(--text-secondary); margin-left: 1rem;">No hay vehículos vigentes en taller para esta sucursal.</p>';
            return;
        }

        // Agregar tarjeta de TOTAL al inicio
        const totalCard = document.createElement('div');
        totalCard.className = 'stat-card stat-total';
        totalCard.innerHTML = `
            <span class="stat-name">TOTAL VIGENTES</span>
            <span class="stat-count">${totalVehicles}</span>
        `;
        statsSummary.appendChild(totalCard);

        sortedEncargados.forEach(enc => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <span class="stat-name">${enc}</span>
                <span class="stat-count">${counts[enc]}</span>
            `;
            statsSummary.appendChild(card);
        });
    }
});
