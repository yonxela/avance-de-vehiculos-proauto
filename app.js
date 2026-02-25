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

    // Checklist elements
    const chkStep1 = document.getElementById('chk-step-1');
    const chkStep2 = document.getElementById('chk-step-2');
    const chkStep3 = document.getElementById('chk-step-3');
    const chkStep4 = document.getElementById('chk-step-4');
    const chkStep5 = document.getElementById('chk-step-5');

    let customEncargados = [];
    let savedVehicles = {}; // { ot: { data } }
    let currentData = null;

    // 1. Cargar datos iniciales de Supabase
    async function initSupabaseData() {
        // Cargar encargados
        const { data: encData } = await _supabase.from('configuracion_encargados').select('nombre');
        if (encData) customEncargados = encData.map(e => e.nombre);

        // Cargar vehículos guardados
        const { data: vehData } = await _supabase.from('seguimiento_vehiculos').select('*');
        if (vehData) {
            vehData.forEach(v => {
                savedVehicles[v.ot] = {
                    encargado: v.encargado,
                    enTaller: v.en_taller,
                    fechaSeguimiento: v.fecha_seguimiento,
                    listo: v.listo,
                    appearances: v.asteriscos,
                    lastUpload: new Date(v.ultima_actualizacion).toLocaleDateString('en-CA')
                };
            });
        }
    }

    await initSupabaseData();

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

                if (isColorCenter && currentData) {
                    currentData = currentData.concat(jsonData.slice(1));
                } else {
                    currentData = jsonData;
                }

                renderTable(currentData);
                loadingState.classList.add('hidden');
                tableContainer.classList.remove('hidden');
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
            const ot = row['B'];
            if (!ot || String(ot).trim() === '') return;
            if (!uniqueOrders.has(ot)) uniqueOrders.set(ot, row);
        });

        let arrayOrders = Array.from(uniqueOrders.values());
        const uniqueEncargadosSet = new Set(customEncargados);
        const hoy = new Date();
        const todayStr = hoy.toLocaleDateString('en-CA');
        hoy.setHours(0, 0, 0, 0);

        arrayOrders.forEach(row => {
            const ot = row['B'];
            const e = row['G'] || '';
            if (e.trim()) uniqueEncargadosSet.add(e.trim());

            let prevData = savedVehicles[ot];
            let asterisks = '';

            if (prevData) {
                let apps = prevData.appearances || 0;
                let isListo = prevData.listo || false;
                if (prevData.lastUpload !== todayStr) {
                    apps += 1;
                    isListo = false;
                }
                row['G'] = prevData.encargado || row['G'];
                row._savedEnTaller = prevData.enTaller;
                row._savedFechaSeg = prevData.fechaSeguimiento;
                row._listo = isListo;
                row._asterisks = '*'.repeat(Math.min(apps, 3));
                row._apps = apps;
            } else {
                row._listo = false;
                row._apps = 0;
                row._asterisks = '';
            }

            // Categoría
            const fechaCol = row['D'] || '';
            let categoryId = 7;
            let categoryName = 'Fecha desconocida';
            if (fechaCol) {
                const parts = fechaCol.split(' ')[0].split('-');
                if (parts.length === 3) {
                    const d = new Date(parts[0], parts[1]-1, parts[2]);
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

        arrayOrders.sort((a, b) => (a._categoryId - b._categoryId) || (a['G']||'').localeCompare(b['G']||''));

        let currentCategory = null;
        let globalCounter = 1;

        arrayOrders.forEach(row => {
            if (row._categoryName !== currentCategory) {
                currentCategory = row._categoryName;
                const trSep = document.createElement('tr');
                trSep.className = 'separator-row';
                trSep.innerHTML = `<td colspan="12">${currentCategory}</td>`;
                tableBody.appendChild(trSep);
            }

            const tr = document.createElement('tr');
            if (row._listo) tr.classList.add('row-tachada');
            const ot = row['B'];
            tr.dataset.encargado = row['G'] || 'Sin Asignar';
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
                updateVehicleField(ot, 'listo', e.target.checked);
            });
            tdListo.appendChild(chk);
            tr.appendChild(tdListo);

            tr.appendChild(createCell(globalCounter++));
            tr.appendChild(createCell(`${ot}${row._asterisks}`));
            tr.appendChild(createCell(row['D'] || ''));

            // Encargado Select
            const tdEnc = document.createElement('td');
            const selEnc = document.createElement('select');
            selEnc.className = 'status-select';
            listEncargados.forEach(enc => {
                const opt = document.createElement('option');
                opt.value = enc; opt.textContent = enc;
                if (enc === row['G']) opt.selected = true;
                selEnc.appendChild(opt);
            });
            selEnc.addEventListener('change', (e) => {
                tr.dataset.encargado = e.target.value;
                updateVehicleField(ot, 'encargado', e.target.value);
            });
            tdEnc.appendChild(selEnc);
            tr.appendChild(tdEnc);

            tr.appendChild(createCell(row['H'] || ''));
            tr.appendChild(createCell(`${row['K'] || ''} ${row['L'] || ''}`));
            tr.appendChild(createCell(row['T'] || ''));

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
                updateVehicleField(ot, 'en_taller', e.target.value);
            });
            tdTaller.appendChild(selTaller);
            tr.appendChild(tdTaller);
            
            if (enTaller === 'SI') tr.classList.add('row-green');
            else if (enTaller === 'NO') tr.classList.add('row-white');
            else tr.classList.add('row-yellow');

            const tdCosto = createCell('Q.' + (row['AO'] || '0.00'));
            tdCosto.className = 'col-costo';
            tr.appendChild(tdCosto);

            const tdObs = document.createElement('td');
            tdObs.innerHTML = `<input type="text" class="status-select" placeholder="Observación...">`;
            tr.appendChild(tdObs);

            const tdFecha = document.createElement('td');
            const inFecha = document.createElement('input');
            inFecha.type = 'date'; inFecha.className = 'status-select fecha-seg-input';
            inFecha.value = row._savedFechaSeg || '';
            inFecha.addEventListener('change', (e) => {
                updateVehicleField(ot, 'fecha_seguimiento', e.target.value);
                applyFilters();
            });
            tdFecha.appendChild(inFecha);
            tr.appendChild(tdFecha);

            tableBody.appendChild(tr);
        });

        btnSaveState.onclick = async function () {
            // Guardar o actualizar todos los vehículos actuales en Supabase
            const updates = arrayOrders.map(row => ({
                ot: row['B'],
                encargado: row['G'],
                en_taller: row._savedEnTaller || 'REVISAR',
                fecha_seguimiento: row._savedFechaSeg || '',
                listo: row._listo || false,
                asteriscos: row._apps || 0,
                ultima_actualizacion: new Date().toISOString()
            }));

            const { error } = await _supabase.from('seguimiento_vehiculos').upsert(updates);
            if (!error) {
                if (chkStep5) chkStep5.checked = true;
                alert('¡Sincronización con Supabase completa!');
            } else {
                alert('Error al sincronizar: ' + error.message);
            }
        };
    }

    async function updateVehicleField(ot, field, value) {
        const update = { ot, [field]: value, ultima_actualizacion: new Date().toISOString() };
        await _supabase.from('seguimiento_vehiculos').upsert([update]);
    }

    function createCell(text) {
        const td = document.createElement('td');
        td.textContent = text;
        return td;
    }
});
