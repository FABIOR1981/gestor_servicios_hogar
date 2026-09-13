import { dataStore } from './dataStore.js';
import { exportServiciosToWord, exportPagosToWord } from './export-word.js';

// Catálogo de nombres sugeridos por categoría (solo para poblar el <select>,
// no es la lista de servicios ya cargados por el usuario).
const catalogoServicios = {
    hogar: ["UTE (Energía Eléctrica)", "ANTEL (Fibra / Fijo)", "Ancel / Movistar / Claro", "OSE (Agua)", "Gas Natural / Garrafa", "Servicio Técnico / Mantenimiento"],
    inmueble: ["Alquiler de Apartamento", "Gastos Comunes", "Tributos Inmobiliarios (IMM/Intendencia)", "Impuesto de Enseñanza Primaria", "Fondo de Garantía"],
    vehiculos: ["Seguro de Auto", "Patente de Rodados (SUCIVE)", "Cochera / Garaje", "Mantenimiento / Taller", "Peajes / Telepeaje"],
    colegio: ["Cuota Mensual Colegio / Liceo", "Matrícula Anual", "Materiales / Libros / Uniforme", "Actividades Extraescolares", "Transporte Escolar / Comedor"],
    varios: ["Tarjeta de Crédito", "Gimnasio / Club", "Servicios Streaming", "Préstamo / Cuota", "Gastos Médicos / Mutualista"],
};

let servicios = [];
let pagos = [];
let currentSection = 'servicios';
let currentCategory = 'hogar';

async function init() {
    setSyncStatus('cargando');
    try {
        [servicios, pagos] = await Promise.all([dataStore.getServicios(), dataStore.getPagos()]);
        setSyncStatus('ok');
    } catch (err) {
        setSyncStatus('error', err.message);
    }
    populateServiceNameOptions();
    renderServiciosTable();
    populatePagoServicioSelect();
    renderPagosTable();
    updateStats();

    document.getElementById('servicio-form').addEventListener('submit', handleServicioSubmit);
    document.getElementById('pago-form').addEventListener('submit', handlePagoSubmit);
}

function setSyncStatus(state, detail) {
    const el = document.getElementById('sync-status');
    if (state === 'cargando') {
        el.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Cargando datos...`;
    } else if (state === 'guardando') {
        el.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...`;
    } else if (state === 'ok') {
        el.innerHTML = `<i class="fa-solid fa-circle-check"></i> Datos al día`;
    } else if (state === 'error') {
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-300"></i> Error: ${detail || 'no se pudo sincronizar'}`;
    }
}

// ===================== SERVICIOS =====================

function switchSection(section) {
    currentSection = section;
    document.getElementById('section-servicios').classList.toggle('hidden', section !== 'servicios');
    document.getElementById('section-pagos').classList.toggle('hidden', section !== 'pagos');
    document.getElementById('section-tab-servicios').classList.toggle('section-tab-active', section === 'servicios');
    document.getElementById('section-tab-pagos').classList.toggle('section-tab-active', section === 'pagos');
}

function switchCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.getElementById(`tab-${category}`).classList.add('tab-active');
    populateServiceNameOptions();
    resetServicioForm();
    renderServiciosTable();
}

function populateServiceNameOptions() {
    const select = document.getElementById('field-service');
    select.innerHTML = '';
    (catalogoServicios[currentCategory] || []).forEach(nombre => {
        const opt = document.createElement('option');
        opt.value = nombre;
        opt.textContent = nombre;
        select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'OTRO_CUSTOM';
    customOpt.textContent = '+ Otro (especificar)...';
    select.appendChild(customOpt);
    checkCustomService(select.value);
}

function checkCustomService(val) {
    const customInput = document.getElementById('field-custom-service');
    const isCustom = val === 'OTRO_CUSTOM';
    customInput.classList.toggle('hidden', !isCustom);
    customInput.required = isCustom;
}

async function handleServicioSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('servicio-id').value;
    let serviceVal = document.getElementById('field-service').value;
    if (serviceVal === 'OTRO_CUSTOM') {
        serviceVal = document.getElementById('field-custom-service').value.trim() || 'Servicio Personalizado';
    }

    const nuevo = {
        id: id || `srv-${Date.now()}`,
        category: currentCategory,
        service: serviceVal,
        account: document.getElementById('field-account').value.trim(),
        responsableDefault: document.getElementById('field-responsable-default').value.trim(),
        notes: document.getElementById('field-servicio-notes').value.trim(),
    };

    if (id) {
        const idx = servicios.findIndex(s => s.id === id);
        if (idx !== -1) servicios[idx] = nuevo;
    } else {
        servicios.push(nuevo);
    }

    await persistirServicios();
    resetServicioForm();
    renderServiciosTable();
    populatePagoServicioSelect();
    showToast(id ? 'Servicio actualizado' : 'Servicio agregado');
}

function editServicio(id) {
    const s = servicios.find(x => x.id === id);
    if (!s) return;

    document.getElementById('servicio-id').value = s.id;
    const select = document.getElementById('field-service');
    const found = Array.from(select.options).some(o => o.value === s.service);
    if (found) {
        select.value = s.service;
        checkCustomService(s.service);
    } else {
        select.value = 'OTRO_CUSTOM';
        checkCustomService('OTRO_CUSTOM');
        document.getElementById('field-custom-service').value = s.service;
    }
    document.getElementById('field-account').value = s.account || '';
    document.getElementById('field-responsable-default').value = s.responsableDefault || '';
    document.getElementById('field-servicio-notes').value = s.notes || '';

    document.getElementById('servicio-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-600"></i> EDITAR SERVICIO`;
    document.getElementById('servicio-btn-submit').innerHTML = `<i class="fa-solid fa-sync"></i> Actualizar`;
    document.getElementById('servicio-btn-cancel').classList.remove('hidden');
    document.getElementById('servicio-editing-badge').classList.remove('hidden');
    window.scrollTo({ top: 180, behavior: 'smooth' });
}

async function deleteServicio(id) {
    const pagosAsociados = pagos.filter(p => p.servicioId === id).length;
    const msg = pagosAsociados > 0
        ? `Este servicio tiene ${pagosAsociados} pago(s) asociado(s), que también se eliminarán. ¿Continuar?`
        : '¿Eliminar este servicio?';
    if (!confirm(msg)) return;

    servicios = servicios.filter(s => s.id !== id);
    pagos = pagos.filter(p => p.servicioId !== id);
    await Promise.all([persistirServicios(), persistirPagos()]);
    renderServiciosTable();
    populatePagoServicioSelect();
    renderPagosTable();
    updateStats();
    showToast('Servicio eliminado', 'trash');
}

function resetServicioForm() {
    document.getElementById('servicio-form').reset();
    document.getElementById('servicio-id').value = '';
    document.getElementById('field-custom-service').classList.add('hidden');
    document.getElementById('servicio-form-title').innerHTML = `<i class="fa-solid fa-plus-circle text-blue-600"></i> NUEVO SERVICIO`;
    document.getElementById('servicio-btn-submit').innerHTML = `<i class="fa-solid fa-save"></i> Guardar Servicio`;
    document.getElementById('servicio-btn-cancel').classList.add('hidden');
    document.getElementById('servicio-editing-badge').classList.add('hidden');
    populateServiceNameOptions();
}

function renderServiciosTable() {
    const tbody = document.getElementById('servicios-table-body');
    const emptyState = document.getElementById('servicios-empty-state');
    const filtrados = servicios.filter(s => s.category === currentCategory);

    tbody.innerHTML = '';
    emptyState.classList.toggle('hidden', filtrados.length > 0);

    filtrados.forEach(s => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3.5 font-semibold text-slate-800">${escapeHtml(s.service)}</td>
            <td class="p-3.5 font-mono text-xs">${escapeHtml(s.account || '-')}</td>
            <td class="p-3.5">${escapeHtml(s.responsableDefault || '-')}</td>
            <td class="p-3.5 text-slate-500 text-xs max-w-xs truncate">${escapeHtml(s.notes || '-')}</td>
            <td class="p-3.5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="app.editServicio('${s.id}')" title="Editar" class="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="app.deleteServicio('${s.id}')" title="Eliminar" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function persistirServicios() {
    setSyncStatus('guardando');
    try {
        await dataStore.saveServicios(servicios);
        setSyncStatus('ok');
    } catch (err) {
        setSyncStatus('error', err.message);
        throw err;
    }
}

// ===================== PAGOS =====================

function populatePagoServicioSelect() {
    const select = document.getElementById('field-pago-servicio');
    select.innerHTML = '';
    servicios.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${etiquetaCategoria(s.category)} · ${s.service}${s.account ? ' · ' + s.account : ''}`;
        select.appendChild(opt);
    });
    onPagoServicioChange();
}

function etiquetaCategoria(cat) {
    return { hogar: 'Hogar', inmueble: 'Inmueble', vehiculos: 'Vehículos', colegio: 'Colegio', varios: 'Varios' }[cat] || cat;
}

function onPagoServicioChange() {
    const servicioId = document.getElementById('field-pago-servicio').value;
    const servicio = servicios.find(s => s.id === servicioId);
    const responsableInput = document.getElementById('field-pago-responsable');
    // Precarga con el responsable por defecto del servicio solo si el campo está vacío
    // o si todavía no fue tocado manualmente para otro servicio.
    if (servicio) responsableInput.value = servicio.responsableDefault || '';
    checkResponsableDistinto();
}

function checkResponsableDistinto() {
    const servicioId = document.getElementById('field-pago-servicio').value;
    const servicio = servicios.find(s => s.id === servicioId);
    const responsableActual = document.getElementById('field-pago-responsable').value.trim();
    const distinto = servicio && servicio.responsableDefault && responsableActual !== servicio.responsableDefault.trim();
    document.getElementById('pago-responsable-hint').classList.toggle('hidden', !distinto);
}

async function handlePagoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('pago-id').value;
    const servicioId = document.getElementById('field-pago-servicio').value;
    const servicio = servicios.find(s => s.id === servicioId);
    const responsable = document.getElementById('field-pago-responsable').value.trim();

    const nuevo = {
        id: id || `pago-${Date.now()}`,
        servicioId,
        currency: document.getElementById('field-pago-currency').value,
        amount: parseFloat(document.getElementById('field-pago-amount').value) || 0,
        duedate: document.getElementById('field-pago-duedate').value,
        status: document.getElementById('field-pago-status').value,
        responsable,
        responsableDistinto: !!(servicio && servicio.responsableDefault && responsable !== servicio.responsableDefault.trim()),
        notes: document.getElementById('field-pago-notes').value.trim(),
    };

    if (id) {
        const idx = pagos.findIndex(p => p.id === id);
        if (idx !== -1) pagos[idx] = nuevo;
    } else {
        pagos.push(nuevo);
    }

    await persistirPagos();
    resetPagoForm();
    renderPagosTable();
    updateStats();
    showToast(id ? 'Pago actualizado' : 'Pago agregado');
}

function editPago(id) {
    const p = pagos.find(x => x.id === id);
    if (!p) return;

    document.getElementById('pago-id').value = p.id;
    document.getElementById('field-pago-servicio').value = p.servicioId;
    document.getElementById('field-pago-currency').value = p.currency;
    document.getElementById('field-pago-amount').value = p.amount;
    document.getElementById('field-pago-duedate').value = p.duedate || '';
    document.getElementById('field-pago-status').value = p.status;
    document.getElementById('field-pago-responsable').value = p.responsable || '';
    document.getElementById('field-pago-notes').value = p.notes || '';
    checkResponsableDistinto();

    document.getElementById('pago-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-600"></i> EDITAR PAGO`;
    document.getElementById('pago-btn-submit').innerHTML = `<i class="fa-solid fa-sync"></i> Actualizar`;
    document.getElementById('pago-btn-cancel').classList.remove('hidden');
    document.getElementById('pago-editing-badge').classList.remove('hidden');
    window.scrollTo({ top: 180, behavior: 'smooth' });
}

async function deletePago(id) {
    if (!confirm('¿Eliminar este pago?')) return;
    pagos = pagos.filter(p => p.id !== id);
    await persistirPagos();
    renderPagosTable();
    updateStats();
    showToast('Pago eliminado', 'trash');
}

function resetPagoForm() {
    document.getElementById('pago-form').reset();
    document.getElementById('pago-id').value = '';
    document.getElementById('pago-form-title').innerHTML = `<i class="fa-solid fa-plus-circle text-blue-600"></i> NUEVO PAGO`;
    document.getElementById('pago-btn-submit').innerHTML = `<i class="fa-solid fa-save"></i> Guardar Pago`;
    document.getElementById('pago-btn-cancel').classList.add('hidden');
    document.getElementById('pago-editing-badge').classList.add('hidden');
    document.getElementById('pago-responsable-hint').classList.add('hidden');
    onPagoServicioChange();
}

function renderPagosTable() {
    const tbody = document.getElementById('pagos-table-body');
    const emptyState = document.getElementById('pagos-empty-state');
    const query = (document.getElementById('pago-search-input').value || '').toLowerCase();

    const filtrados = pagos.filter(p => {
        const servicio = servicios.find(s => s.id === p.servicioId);
        const texto = `${servicio ? servicio.service : ''} ${p.responsable || ''} ${p.notes || ''}`.toLowerCase();
        return texto.includes(query);
    });

    tbody.innerHTML = '';
    emptyState.classList.toggle('hidden', filtrados.length > 0);

    filtrados.forEach(p => {
        const servicio = servicios.find(s => s.id === p.servicioId);
        let formattedDate = '-';
        if (p.duedate) {
            const parts = p.duedate.split('-');
            if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        let statusBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">Pendiente</span>`;
        if (p.status === 'Pagado') statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">Pagado</span>`;
        if (p.status === 'Debito Automatico') statusBadge = `<span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">Débito Aut.</span>`;

        const responsableCell = p.responsableDistinto
            ? `${escapeHtml(p.responsable || '-')} <span class="badge-responsable-distinto text-xs px-2 py-0.5 rounded-full ml-1">no habitual</span>`
            : escapeHtml(p.responsable || '-');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
            <td class="p-3.5 font-semibold text-slate-800">${servicio ? escapeHtml(servicio.service) : '(servicio eliminado)'}</td>
            <td class="p-3.5 text-right font-bold">${p.currency} ${p.amount.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</td>
            <td class="p-3.5 text-center font-mono text-xs">${formattedDate}</td>
            <td class="p-3.5 text-center">${statusBadge}</td>
            <td class="p-3.5">${responsableCell}</td>
            <td class="p-3.5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="app.editPago('${p.id}')" title="Editar" class="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="app.deletePago('${p.id}')" title="Eliminar" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function persistirPagos() {
    setSyncStatus('guardando');
    try {
        await dataStore.savePagos(pagos);
        setSyncStatus('ok');
    } catch (err) {
        setSyncStatus('error', err.message);
        throw err;
    }
}

// ===================== STATS / UTILS =====================

function updateStats() {
    document.getElementById('stat-servicios-count').textContent = servicios.length;
    document.getElementById('stat-pending-count').textContent = pagos.filter(p => p.status === 'Pendiente').length;
    document.getElementById('stat-paid-count').textContent = pagos.filter(p => p.status === 'Pagado' || p.status === 'Debito Automatico').length;
    const totalUyu = pagos.filter(p => p.currency === '$U').reduce((acc, p) => acc + (p.amount || 0), 0);
    document.getElementById('stat-total-amount').textContent = `$U ${totalUyu.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function showToast(msg, icon = 'check') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    document.getElementById('toast-icon').className = icon === 'trash' ? 'fa-solid fa-trash-can text-red-400' : 'fa-solid fa-circle-check text-emerald-400';
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

// Exponer las funciones que usan los onclick del HTML
window.app = {
    switchSection, switchCategory, checkCustomService, editServicio, deleteServicio, resetServicioForm,
    onPagoServicioChange, checkResponsableDistinto, editPago, deletePago, resetPagoForm, renderPagosTable,
    exportServicios: () => exportServiciosToWord(servicios),
    exportPagos: () => exportPagosToWord(pagos, servicios),
};

init();
