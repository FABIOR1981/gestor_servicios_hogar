const categoryLabels = {
    hogar: 'Servicios del Hogar (UTE, ANTEL, OSE, etc.)',
    inmueble: 'Gastos de Inmueble',
    vehiculos: 'Vehículos',
    colegio: 'Colegio / Educación',
    varios: 'Otros Gastos Varios',
};

const wordStyles = `
    body { font-family: 'Calibri', 'Arial', sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; }
    .header-title { color: #0038a8; font-size: 24pt; font-weight: bold; text-align: center; margin-bottom: 5px; }
    .subtitle { text-align: center; color: #64748b; font-size: 11pt; margin-bottom: 25px; border-bottom: 2px solid #0038a8; padding-bottom: 10px; }
    .section-title { color: #0f172a; font-size: 14pt; font-weight: bold; margin-top: 25px; margin-bottom: 10px; background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #0038a8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
    th { background-color: #0038a8; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #0038a8; }
    td { padding: 8px; border: 1px solid #cbd5e1; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .status-pagado { color: #166534; font-weight: bold; }
    .status-pendiente { color: #9a3412; font-weight: bold; }
    .status-debito { color: #1e40af; font-weight: bold; }
    .summary-box { margin-top: 30px; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 5px; }
    .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #94a3b8; }
`;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text ?? '';
    return div.innerHTML;
}

function fechaHoy() {
    return new Date().toLocaleDateString('es-UY', { year: 'numeric', month: 'long', day: 'numeric' });
}

function descargarComoWord(htmlContent, nombreArchivo) {
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function envoltorioHtml(tituloDoc, subtitulo, cuerpo) {
    return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${tituloDoc}</title><style>${wordStyles}</style></head>
    <body>
        <div class="header-title">${tituloDoc}</div>
        <div class="subtitle">${subtitulo} | Generado el ${fechaHoy()}</div>
        ${cuerpo}
        <div class="footer">Documento generado mediante la aplicación de Registro de Servicios del Hogar (Uruguay).</div>
    </body>
    </html>`;
}

// ===================== EXPORTAR SERVICIOS =====================

export function exportServiciosToWord(servicios) {
    if (!servicios || servicios.length === 0) {
        alert('No hay servicios registrados para exportar.');
        return;
    }

    let cuerpo = '';
    const categorias = ['hogar', 'inmueble', 'vehiculos', 'colegio', 'varios'];

    categorias.forEach(cat => {
        const items = servicios.filter(s => s.category === cat);
        if (items.length === 0) return;

        cuerpo += `<div class="section-title">${categoryLabels[cat]}</div>`;
        cuerpo += `
            <table>
                <thead>
                    <tr><th>Servicio</th><th>Cuenta / Contrato</th><th>Responsable por defecto</th><th>Notas</th></tr>
                </thead>
                <tbody>
                    ${items.map(s => `
                        <tr>
                            <td><b>${escapeHtml(s.service)}</b></td>
                            <td>${escapeHtml(s.account || '-')}</td>
                            <td>${escapeHtml(s.responsableDefault || '-')}</td>
                            <td>${escapeHtml(s.notes || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    });

    cuerpo += `
        <div class="summary-box">
            <p style="font-size:10pt; color:#64748b;">Total de servicios registrados: <b>${servicios.length}</b></p>
        </div>
    `;

    const html = envoltorioHtml('REGISTRO DE SERVICIOS DEL HOGAR', 'Catálogo de servicios registrados', cuerpo);
    descargarComoWord(html, `Servicios_Hogar_${new Date().toISOString().slice(0, 10)}.doc`);
}

// ===================== EXPORTAR PAGOS =====================

export function exportPagosToWord(pagos, servicios) {
    if (!pagos || pagos.length === 0) {
        alert('No hay pagos registrados para exportar.');
        return;
    }

    const servicioPorId = Object.fromEntries(servicios.map(s => [s.id, s]));
    const categorias = ['hogar', 'inmueble', 'vehiculos', 'colegio', 'varios'];
    let cuerpo = '';
    let totalUyu = 0;
    let totalUsd = 0;

    categorias.forEach(cat => {
        const items = pagos.filter(p => servicioPorId[p.servicioId]?.category === cat);
        if (items.length === 0) return;

        cuerpo += `<div class="section-title">${categoryLabels[cat]}</div>`;
        cuerpo += `
            <table>
                <thead>
                    <tr>
                        <th>Servicio</th><th style="text-align:right;">Importe</th><th style="text-align:center;">Vencimiento</th>
                        <th style="text-align:center;">Estado</th><th>Responsable</th><th>Notas</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(p => {
                        const servicio = servicioPorId[p.servicioId];
                        let statusClass = 'status-pendiente';
                        if (p.status === 'Pagado') statusClass = 'status-pagado';
                        if (p.status === 'Debito Automatico') statusClass = 'status-debito';

                        let fecha = '-';
                        if (p.duedate) {
                            const parts = p.duedate.split('-');
                            if (parts.length === 3) fecha = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }

                        if (p.currency === '$U') totalUyu += (p.amount || 0);
                        if (p.currency === 'USD') totalUsd += (p.amount || 0);

                        const responsableTxt = p.responsableDistinto
                            ? `${escapeHtml(p.responsable || '-')} (no habitual)`
                            : escapeHtml(p.responsable || '-');

                        return `
                            <tr>
                                <td><b>${servicio ? escapeHtml(servicio.service) : '(servicio eliminado)'}</b></td>
                                <td style="text-align:right;"><b>${p.currency} ${(p.amount || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })}</b></td>
                                <td style="text-align:center;">${fecha}</td>
                                <td style="text-align:center;" class="${statusClass}">${escapeHtml(p.status)}</td>
                                <td>${responsableTxt}</td>
                                <td>${escapeHtml(p.notes || '-')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    });

    cuerpo += `
        <div class="summary-box">
            <h3 style="margin-top:0; color:#0038a8;">RESUMEN TOTAL DE PAGOS REGISTRADOS</h3>
            <p style="font-size:12pt; margin:5px 0;"><b>Total en Pesos Uruguayos ($U):</b> $U ${totalUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</p>
            ${totalUsd > 0 ? `<p style="font-size:12pt; margin:5px 0;"><b>Total en Dólares (USD):</b> USD ${totalUsd.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</p>` : ''}
            <p style="font-size:10pt; color:#64748b; margin-top:10px;">Total de pagos registrados: <b>${pagos.length}</b></p>
        </div>
    `;

    const html = envoltorioHtml('REGISTRO DE PAGOS DEL HOGAR', 'Reporte consolidado de pagos', cuerpo);
    descargarComoWord(html, `Pagos_Hogar_${new Date().toISOString().slice(0, 10)}.doc`);
}
