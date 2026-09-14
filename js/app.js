import { dataStore } from './dataStore.js';
import { exportServiciosToWord } from './export-word.js';

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
let currentCategory = 'hogar';

async function init() {
    setSyncStatus('cargando');
    try {
        servicios = await dataStore.getServicios();
        setSyncStatus('ok');
    } catch (err) {
        setSyncStatus('error', err.message);
    }
    populateServiceNameOptions();
    renderServiciosTable();
    updateStats();

    document.getElementById('servicio-form').addEventListener('submit', handleServicioSubmit);
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
    updateStats();
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
    document.getElementById('field-servicio-notes').value = s.notes || '';

    document.getElementById('servicio-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-600"></i> EDITAR SERVICIO`;
    document.getElementById('servicio-btn-submit').innerHTML = `<i class="fa-solid fa-sync"></i> Actualizar`;
    document.getElementById('servicio-btn-cancel').classList.remove('hidden');
    document.getElementById('servicio-editing-badge').classList.remove('hidden');
    window.scrollTo({ top: 180, behavior: 'smooth' });
}

async function deleteServicio(id) {
    if (!confirm('¿Eliminar este servicio?')) return;
    servicios = servicios.filter(s => s.id !== id);
    await persistirServicios();
    renderServiciosTable();
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

// ===================== STATS / UTILS =====================

function updateStats() {
    document.getElementById('stat-servicios-count').textContent = servicios.length;
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
    switchCategory, checkCustomService, editServicio, deleteServicio, resetServicioForm,
    exportServicios: () => exportServiciosToWord(servicios),
    exportServiciosCompacto: () => exportServiciosToWord(servicios, true),
};

init();
