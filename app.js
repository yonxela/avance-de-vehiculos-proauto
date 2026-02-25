document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('excel-upload');
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

    let customEncargados = JSON.parse(localStorage.getItem('customEncargados')) || [];
    let savedVehicles = JSON.parse(localStorage.getItem('savedVehiclesData')) || {};
    let currentData = null;

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
            if (row.classList.contains('separator-row')) {
                // Ignore separators for now, clean them up after
                return;
            }

            const inputDateEle = row.querySelector('.fecha-seg-input');
            const inputDate = inputDateEle ? inputDateEle.value : '';
            const rowEncargado = row.dataset.encargado || '';

            let dateMatch = false;

            // Filtro Fecha
            if (!inputDate) {
                if (showSinFecha) dateMatch = true;
            } else {
                if (inputDate <= todayStr && showHoyVencidas) dateMatch = true;
                else if (inputDate > todayStr && showFuturas) dateMatch = true;
            }

            // Filtro Encargado
            let encargadoMatch = true;
            if (selectedEncargado !== '') {
                encargadoMatch = rowEncargado === selectedEncargado;
            }

            if (dateMatch && encargadoMatch) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });

        // Cleanup empty separators
        let currentSectorHeader = null;
        let sectorHasRows = false;

        allRows.forEach(row => {
            if (row.classList.contains('separator-row')) {
                if (currentSectorHeader && !sectorHasRows) {
                    currentSectorHeader.classList.add('hidden');
                }
                currentSectorHeader = row;
                sectorHasRows = false;
                row.classList.remove('hidden'); // Reset to check again
            } else if (!row.classList.contains('hidden')) {
                sectorHasRows = true;
            }
        });

        if (currentSectorHeader && !sectorHasRows) {
            currentSectorHeader.classList.add('hidden');
        }
    }

    // Añadir encargado manual
    addEncargadoBtn.addEventListener('click', () => {
        const nuevoName = prompt("Ingresa el nombre del nuevo mecánico o encargado:");
        if (nuevoName && nuevoName.trim() !== '') {
            const cleanName = nuevoName.trim().toUpperCase();
            if (!customEncargados.includes(cleanName)) {
                customEncargados.push(cleanName);
                localStorage.setItem('customEncargados', JSON.stringify(customEncargados));
                if (currentData) {
                    renderTable(currentData);
                    applyFilters();
                }
                alert(`¡Encargado "${cleanName}" añadido con éxito!`);
            } else {
                alert("Ese encargado ya existe en la lista.");
            }
        }
    });

    // Imprimir normal sin color (Paso 3)
    printNormalBtn.addEventListener('click', () => {
        if (chkStep3) chkStep3.checked = true; // Auto-check pas 3

        document.body.classList.add('print-bw-compact');

        // Timeout para que el navegador aplique los estilos antes de abrir el dialogo de impresión
        setTimeout(() => {
            window.print();

            // Remover clase despues de imprimir
            window.addEventListener('afterprint', function removeClass() {
                document.body.classList.remove('print-bw-compact');
                window.removeEventListener('afterprint', removeClass);
            }, { once: true });

            // Fallback en caso de que afterprint no dispare
            setTimeout(() => {
                document.body.classList.remove('print-bw-compact');
            }, 3000);
        }, 100);
    });

    // Imprimir filtrando por encargado
    printBtn.addEventListener('click', () => {
        const selectedEncargado = printEncargado.value;
        const allRows = tableBody.querySelectorAll('tr');

        if (!selectedEncargado || selectedEncargado === "") {
            alert('Por favor selecciona un encargado en la lista para imprimir su reporte específico.');
            return;
        }

        // Ocultar las que no son del encargado (si hay seleccionado)
        if (selectedEncargado) {
            allRows.forEach(row => {
                // Ignore category separators that don't belong to any encargado but are empty?
                // Wait, separators do not have dataset.encargado. We might want to hide separators or keep them.
                if (!row.classList.contains('separator-row') && row.dataset.encargado !== selectedEncargado) {
                    row.classList.add('hidden-print');
                } else if (!row.classList.contains('separator-row')) {
                    row.classList.remove('hidden-print');
                }
            });

            // Cleanup separators if they don't have following visible rows
            let currentSectorHeader = null;
            let sectorHasRows = false;

            allRows.forEach(row => {
                if (row.classList.contains('separator-row')) {
                    if (currentSectorHeader && !sectorHasRows) {
                        currentSectorHeader.classList.add('hidden-print');
                    }
                    currentSectorHeader = row;
                    sectorHasRows = false;
                    row.classList.remove('hidden-print');
                } else if (!row.classList.contains('hidden-print')) {
                    sectorHasRows = true;
                }
            });

            if (currentSectorHeader && !sectorHasRows) {
                currentSectorHeader.classList.add('hidden-print');
            }
        }

        if (chkStep4) chkStep4.checked = true; // Auto-check step 4 if successful

        document.body.classList.add('print-bw-compact');

        setTimeout(() => {
            window.print();

            // Restaurar visualmente
            window.addEventListener('afterprint', function removeClass() {
                document.body.classList.remove('print-bw-compact');
                allRows.forEach(row => row.classList.remove('hidden-print'));
                window.removeEventListener('afterprint', removeClass);
            }, { once: true });

            setTimeout(() => {
                document.body.classList.remove('print-bw-compact');
                allRows.forEach(row => row.classList.remove('hidden-print'));
            }, 3000);
        }, 100);
    });

    // Handle Uploads
    function handleExcelUpload(e, isColorCenter) {
        const file = e.target.files[0];
        if (!file) return;

        // Mostrar loading
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

                // Merge appends if Color Center, else clear
                if (isColorCenter && currentData) {
                    currentData = currentData.concat(jsonData.slice(1)); // Skip header row of second file
                } else {
                    currentData = jsonData;
                }

                renderTable(currentData);

                // Mostrar tabla
                loadingState.classList.add('hidden');
                tableContainer.classList.remove('hidden');
                document.getElementById('print-controls-general').classList.remove('hidden');
                document.getElementById('print-controls-encargado').classList.remove('hidden');
                document.getElementById('action-guardar').classList.remove('hidden');
                btnSaveState.classList.remove('hidden');
                filterControls.classList.remove('hidden');

                applyFilters();

                if (isColorCenter) {
                    if (chkStep2) chkStep2.checked = true;
                } else {
                    if (chkStep1) chkStep1.checked = true;
                }
            } catch (error) {
                console.error("Error al procesar el archivo Excel:", error);
                alert("Hubo un error al leer el archivo: " + error.message);
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

        // El primer registro es la fila de encabezados que exporta el sistema, no la mostramos.
        const rows = data.slice(1);

        // Agrupar por OT (Columna B) ya que el reporte muestra varias filas por orden (una por servicio/producto)
        const uniqueOrders = new Map();

        rows.forEach((row) => {
            const ot = row['B'];
            if (!ot || String(ot).trim() === '') return;
            if (uniqueOrders.has(ot)) return;
            uniqueOrders.set(ot, row);
        });

        // Convertir el Mapa a un Array para poder ordenarlo
        let arrayOrders = Array.from(uniqueOrders.values());

        // Obtener encargados únicos y calcular categorías de tiempo
        const uniqueEncargados = new Set(customEncargados);
        const hoy = new Date();
        const todayStr = hoy.toLocaleDateString('en-CA');
        hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día

        // Update tracking and occurrences
        let newSavedVehicles = {};

        arrayOrders.forEach(row => {
            const ot = row['B'];
            const e = row['G'] || '';
            if (e.trim()) uniqueEncargados.add(e.trim());

            // Check if OT was saved before
            let prevData = savedVehicles[ot];
            let asterisks = '';

            if (prevData) {
                // If the last upload date wasn't today, it means it survived another day in the report!
                let apps = prevData.appearances || 0;
                let isListo = prevData.listo || false;
                if (prevData.lastUpload !== todayStr) {
                    apps += 1; // Increment appearance
                    isListo = false; // "si aparecen en el reporte de la siguiente vez que se desmarquen"
                }

                // Inherit saved data state instead of wiping it
                row['G'] = prevData.encargado || row['G'];
                row._savedEnTaller = prevData.enTaller;
                row._savedFechaSeg = prevData.fechaSeguimiento;
                row._listo = isListo;

                newSavedVehicles[ot] = {
                    appearances: apps,
                    lastUpload: todayStr,
                    encargado: row['G'],
                    enTaller: prevData.enTaller,
                    fechaSeguimiento: prevData.fechaSeguimiento,
                    listo: isListo
                };

                // Create asterisk string (e.g. 1 reappearance = 1 asterisk)
                if (apps > 0) {
                    asterisks = '*'.repeat(Math.min(apps, 3)); // Max 3 asterisks to avoid clutter
                }
            } else {
                newSavedVehicles[ot] = {
                    appearances: 0,
                    lastUpload: todayStr,
                    encargado: row['G'] || '',
                    enTaller: 'REVISAR',
                    fechaSeguimiento: '',
                    listo: false
                };
                row._listo = false;
            }
            row._asterisks = asterisks;

            // Lógica de categoría de tiempo
            const fechaCol = row['D'] || '';
            let categoryId = 7;
            let categoryName = 'Fecha desconocida';

            if (fechaCol) {
                const dateParts = fechaCol.split(' ')[0].split('-');
                if (dateParts.length === 3) {
                    const ordenDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    ordenDate.setHours(0, 0, 0, 0);

                    const diffTime = hoy.getTime() - ordenDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 7) {
                        categoryId = 1;
                        categoryName = '1. Esta semana';
                    } else if (diffDays <= 14) {
                        categoryId = 2;
                        categoryName = '2. Semana pasada';
                    } else if (diffDays <= 21) {
                        categoryId = 3;
                        categoryName = '3. Hace 3 semanas';
                    } else if (diffDays <= 60) {
                        categoryId = 4;
                        categoryName = '4. Hace más de 1 mes';
                    } else if (diffDays <= 90) {
                        categoryId = 5;
                        categoryName = '5. Hace más de 2 meses';
                    } else {
                        categoryId = 6;
                        categoryName = '6. De 3 meses para atrás';
                    }
                }
            }
            row._categoryId = categoryId;
            row._categoryName = categoryName;
        });
        const listEncargados = Array.from(uniqueEncargados).sort();

        // Poblar el select de impresión
        printEncargado.innerHTML = '<option value="">Todos los Encargados</option>';
        listEncargados.forEach(enc => {
            const opt = document.createElement('option');
            opt.value = enc;
            opt.textContent = enc;
            printEncargado.appendChild(opt);
        });

        // Ordenar el arreglo primero por Categoría, y luego por "ENCARGADO" alfabéticamente
        arrayOrders.sort((a, b) => {
            const catA = a._categoryId || 7;
            const catB = b._categoryId || 7;
            if (catA !== catB) return catA - catB;

            const encargadoA = (a['G'] || '').toLowerCase();
            const encargadoB = (b['G'] || '').toLowerCase();
            if (encargadoA < encargadoB) return -1;
            if (encargadoA > encargadoB) return 1;
            return 0;
        });

        let currentCategory = null;
        let globalCounter = 1;

        // Ahora renderizamos cada fila ordenada, añadiendo su número de conteo
        arrayOrders.forEach((row) => {
            if (row._categoryName !== currentCategory) {
                currentCategory = row._categoryName;
                const trSep = document.createElement('tr');
                trSep.className = 'separator-row';
                const tdSep = document.createElement('td');
                tdSep.colSpan = 12; // Cubrir todas las 12 columnas (1 extra check)
                tdSep.textContent = currentCategory;
                trSep.appendChild(tdSep);
                tableBody.appendChild(trSep);
            }

            const tr = document.createElement('tr');
            if (row._listo) {
                tr.classList.add('row-tachada');
            }

            // Número de fila (Necesitamos sacar 'ot' antes del listener)
            const ot = row['B'];

            // Columna LISTO
            const tdListo = document.createElement('td');
            const chkListo = document.createElement('input');
            chkListo.type = 'checkbox';
            chkListo.className = 'listo-checkbox';
            chkListo.style.width = '1.25rem';
            chkListo.style.height = '1.25rem';
            chkListo.style.cursor = 'pointer';
            chkListo.checked = row._listo;
            chkListo.addEventListener('change', (e) => {
                if (newSavedVehicles[ot]) {
                    newSavedVehicles[ot].listo = e.target.checked;
                }
                if (e.target.checked) {
                    tr.classList.add('row-tachada');
                } else {
                    tr.classList.remove('row-tachada');
                }
            });
            tdListo.appendChild(chkListo);
            tdListo.style.textAlign = 'center';
            tr.appendChild(tdListo);

            // Número de fila
            const numeroIdentificador = globalCounter++;

            // Extraer y formatear datos
            const fechaCol = row['D'] || ''; // Col D: Fecha de creación
            // Limpiar " AM"/" PM" para que sea más corto, o dejarla como viene
            const fechaOrden = fechaCol;

            const encargado = row['G'] || ''; // Col G: Creado por
            const placa = row['H'] || ''; // Col H: Placa del vehículo
            const tipoVehi = row['J'] || ''; // Col J: Estilo
            const marca = row['K'] || ''; // Col K: Marca
            const linea = row['L'] || ''; // Col L: Modelo
            const cliente = row['T'] || ''; // Col T: Cliente

            // Lógica "En Taller": Inherit from save or compute
            const estadoSistema = String(row['V'] || '').toUpperCase();
            let enTaller = row._savedEnTaller !== undefined ? row._savedEnTaller : 'REVISAR';

            if (estadoSistema === 'ENTREGADO' || estadoSistema === 'FINALIZADO' || estadoSistema === 'FACTURADO') {
                enTaller = 'NO';
            }

            const costoOrden = 'Q.' + (row['AO'] || '0.00'); // Col AO: Total

            const observacion = '';
            const fechaSeguimiento = row._savedFechaSeg || '';

            // Determinar color de la fila basado en 'EN TALLER'
            if (enTaller === 'SI') {
                tr.classList.add('row-green');
            } else if (enTaller === 'NO') {
                tr.classList.add('row-white');
            } else if (enTaller === 'REVISAR') {
                tr.classList.add('row-yellow');
            } else {
                tr.classList.add('row-white'); // Blanco por defecto alternativo
            }

            // Validar si tiene más de 3 meses de antigüedad
            if (fechaOrden) {
                const dateParts = fechaOrden.split(' ')[0].split('-');
                if (dateParts.length === 3) {
                    const ordenDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    const hoy = new Date();
                    const haceTresMeses = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());
                    if (ordenDate < haceTresMeses) {
                        tr.classList.add('underline-corinto');
                    }
                }
            }

            // --- Construir Celdas ---

            // # (Contador)
            tr.appendChild(createCell(numeroIdentificador));
            // OT + Asterisks if reappearing
            tr.appendChild(createCell(`${ot}${row._asterisks}`));
            // FECHA ORDEN
            tr.appendChild(createCell(fechaOrden));
            // ENCARGADO (Editable)
            const tdEnc = document.createElement('td');
            const selectEnc = document.createElement('select');
            selectEnc.className = 'status-select';
            listEncargados.forEach(enc => {
                const opt = document.createElement('option');
                opt.value = enc;
                opt.textContent = enc;
                if (enc === encargado) opt.selected = true;
                selectEnc.appendChild(opt);
            });
            // Opción vacía o extra si se necesita
            if (!listEncargados.includes(encargado)) {
                const opt = document.createElement('option');
                opt.value = encargado;
                opt.textContent = encargado || 'Sin Asignar';
                opt.selected = true;
                selectEnc.appendChild(opt);
            }

            // Atributo para filtrado en impresión
            tr.dataset.encargado = encargado || 'Sin Asignar';
            tr.dataset.ot = ot; // Set to easily find during save

            selectEnc.addEventListener('change', (e) => {
                tr.dataset.encargado = e.target.value;
                if (newSavedVehicles[ot]) {
                    newSavedVehicles[ot].encargado = e.target.value;
                }
            });

            tdEnc.appendChild(selectEnc);
            tr.appendChild(tdEnc);

            // PLACA
            tr.appendChild(createCell(placa));
            // VEHÍCULO (Marca + Línea)
            const vehiculoStr = `${marca} ${linea}`.trim();
            tr.appendChild(createCell(vehiculoStr));
            // CLIENTE
            tr.appendChild(createCell(cliente));

            // EN TALLER (Editable / Select)
            const tdTaller = document.createElement('td');
            const selectTaller = document.createElement('select');
            selectTaller.className = 'status-select';
            ['REVISAR', 'SI', 'NO'].forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (opt === enTaller) option.selected = true;
                selectTaller.appendChild(option);
            });

            // Cambiar color de fila si cambia el select
            selectTaller.addEventListener('change', (e) => {
                const val = e.target.value;
                tr.classList.remove('row-green', 'row-white', 'row-yellow');
                if (val === 'SI') tr.classList.add('row-green');
                else if (val === 'NO') tr.classList.add('row-white');
                else if (val === 'REVISAR') tr.classList.add('row-yellow');

                if (newSavedVehicles[ot]) {
                    newSavedVehicles[ot].enTaller = val;
                }
            });
            tdTaller.appendChild(selectTaller);
            tr.appendChild(tdTaller);

            // COSTO Q EN ORDEN
            const tdCosto = createCell(costoOrden);
            tdCosto.className = 'col-costo';
            tr.appendChild(tdCosto);

            // OBSERVACION (Editable)
            const tdObs = document.createElement('td');
            const inputObs = document.createElement('input');
            inputObs.type = 'text';
            inputObs.value = observacion;
            inputObs.className = 'status-select';
            inputObs.placeholder = 'Añadir observación...';
            tdObs.appendChild(inputObs);
            tr.appendChild(tdObs);

            // FECHA DE SEGUIMIENTO (Editable / date input)
            const tdFechaSeg = document.createElement('td');
            const inputFechaSeg = document.createElement('input');
            inputFechaSeg.type = 'date';
            inputFechaSeg.className = 'status-select fecha-seg-input';
            if (fechaSeguimiento) inputFechaSeg.value = fechaSeguimiento;

            // Re-filtrar si cambiamos la fecha teniendo un filtro activo
            inputFechaSeg.addEventListener('change', () => {
                const val = inputFechaSeg.value;
                if (newSavedVehicles[ot]) {
                    newSavedVehicles[ot].fechaSeguimiento = val;
                }
                applyFilters();
            });

            tdFechaSeg.appendChild(inputFechaSeg);
            tr.appendChild(tdFechaSeg);

            tableBody.appendChild(tr);
        });

        savedVehicles = newSavedVehicles; // Memory update

        // Save state action
        btnSaveState.onclick = function () {
            localStorage.setItem('savedVehiclesData', JSON.stringify(savedVehicles));
            if (chkStep5) chkStep5.checked = true;
            alert('¡Progreso diario guardado! Los vehículos que ya no aparecieron hoy han sido purgados, y tus datos de En Taller y Encargado fueron respaldados.');
        };
    }

    function createCell(text) {
        const td = document.createElement('td');
        td.textContent = text;
        return td;
    }
});
