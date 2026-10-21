const App = (() => {
    const TIPOS = ['senzo', 'nensai', 'ireisai', 'shinrei', 'mitamaeshi', 'eidai'];
    const TIPO_LBL = {
        senzo: 'Senzo Saishi', nensai: 'Nensai', ireisai: 'Ireisai',
        shinrei: 'Shinrei Saishi', mitamaeshi: 'Mitamaeshi', eidai: 'Eidai Saishi'
    };
    const ESTADO_CLS = {
        pendiente_validacion: 'warn', en_revision: 'gray', aprobada: 'ok',
        registrada: 'ok', observada: 'err', extemporanea: 'err', transferida: 'gray'
    };
    const ESTADO_LBL = {
        pendiente_validacion: 'Pendiente de Validación', en_revision: 'En Revisión',
        aprobada: 'Aprobada', registrada: 'Registrada', observada: 'Observada',
        extemporanea: 'Extemporánea', transferida: 'Transferida'
    };

    let currentView = 'inicio';
    const NAV = {
        comunes: [
            ['inicio', '🏠', 'Inicio'],
            ['solicitudes', '📜', 'Solicitudes'],
            ['almas', '🕯️', 'Almas'],
            ['fallecer', '⚰️', 'Fallecim.'],
            ['calendario', '🗓️', 'Cultos'],
            ['config', '⚙️', 'Más'],
        ],
        extra: {
            bandeja: ['bandeja', '📥', 'Bandeja'],
            firmas: ['firmas', '✍️', 'Firmas'],
            orientaciones: ['orientaciones', '🧭', 'Orientar'],
            reportes: ['reportes', '📊', 'Reportes'],
        }
    };

    const $ = sel => document.querySelector(sel);
    const el = (tag, cls, html) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html !== undefined) n.innerHTML = html;
        return n;
    };

    function openModal(html) { $('#modal-body').innerHTML = html; $('#modal-overlay').classList.add('show'); }
    function closeModal() { $('#modal-overlay').classList.remove('show'); $('#modal-body').innerHTML = ''; }

    function can(roles) { return roles.includes(API.usuario && API.usuario.rol); }

    function badge(estado, extra) {
        return `<span class="badge ${ESTADO_CLS[estado] || 'gray'}">${ESTADO_LBL[estado] || estado}${extra ? ' · ' + extra : ''}</span>`;
    }

    function tipoName(t) { return TIPO_LBL[t] || t; }

    async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function setNav() {
        const nav = $('#bottom-nav');
        const items = [...NAV.comunes];
        const r = API.usuario.rol;
        if (['responsable', 'presidente', 'administrador'].includes(r)) items.push(NAV.extra.bandeja);
        if (['ministro', 'administrador'].includes(r)) {
            items.push(NAV.extra.firmas);
            items.push(NAV.extra.orientaciones);
        }
        if (['presidente', 'administrador'].includes(r)) items.push(NAV.extra.reportes);

        nav.innerHTML = items.map(([v, ico, lbl]) =>
            `<button data-view="${v}" class="${v === currentView ? 'active' : ''}"><span class="ico">${ico}</span>${lbl}</button>`
        ).join('');
        nav.querySelectorAll('button').forEach(b => {
            b.addEventListener('click', () => setView(b.dataset.view));
        });
    }

    function setView(view) {
        const titles = {
            inicio: 'Inicio', solicitudes: 'Solicitudes', bandeja: 'Bandeja Departamental',
            almas: 'Libro de Almas', fallecer: 'Registro de Fallecimiento',
            firmas: 'Firmas Eidai', orientaciones: 'Orientaciones',
            calendario: 'Calendario de Cultos', reportes: 'Reportes Consolidados', config: 'Configuración'
        };
        closeModal();
        const nav = $('#bottom-nav');
        if (!nav.querySelector(`[data-view="${view}"]`)) view = 'inicio';
        currentView = view;
        nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        $('#header-title').textContent = titles[view];
        const loaders = {
            inicio: renderInicio, solicitudes: renderSolicitudes, bandeja: renderBandeja,
            almas: renderAlmas, fallecer: renderFallecer, firmas: renderFirmas,
            orientaciones: renderOrientaciones, calendario: renderCalendario,
            reportes: renderReportes, config: renderConfig
        };
        loaders[view]();
    }

    function showBanner(msg, tipo = 'err') {
        const b = el('div', 'banner ' + tipo, (tipo === 'err' ? '⚠️ ' : tipo === 'warn' ? '📌 ' : '✅ ') + msg);
        $('#main-content').prepend(b);
        setTimeout(() => b.remove(), 4000);
    }

    // ================= INICIO =================
    async function renderInicio() {
        const c = $('#main-content');
        c.innerHTML = '<div class="center muted">Cargando...</div>';
        try {
            const d = await API.dashboard();
            const t = d.totales;
            const r = API.usuario.rol;
            const stats = [
                ['📜', t.mias, 'Mis solicitudes', ''],
                ['🕯️', t.antepasados, 'Antepasados', ''],
            ];
            if (t.bandeja !== undefined) stats.push(['📥', t.bandeja, 'En bandeja', '']);
            if (t.firmas_pendientes !== undefined) stats.push(['✍️', t.firmas_pendientes, 'Firmas pend.', '']);
            if (t.fallecimientos !== undefined) stats.push(['⚰️', t.fallecimientos, 'Fallecim.', '']);
            if (['presidente', 'administrador'].includes(r)) stats.push(['📊', t.registradas || 0, 'Registradas', '']);

            const cultos = d.proximos_cultos.map(ck =>
                `<div class="list-item">
                    <div class="avatar">🗓️</div>
                    <div class="info">
                        <div class="title">${tipoName(ck.tipo || 'culto')}</div>
                        <div class="sub">${ck.fecha} ${ck.hora ? '· ' + ck.hora : ''}${ck.lugar ? ' · ' + ck.lugar : ''}${ck.solicitante ? ' · ' + ck.solicitante : ''}</div>
                    </div>
                </div>`
            ).join('');

            let quick = '';
            if (can(['miembro', 'misionero', 'ministro', 'responsable', 'presidente', 'administrador'])) {
                quick = `<div class="fab-row">
                    <button class="btn btn-primary" onclick="App.nuevaSolicitud()">📜 Nueva solicitud</button>
                    <button class="btn btn-outline" onclick="App.go('almas')">🕯️ Libro de almas</button>
                </div>`;
            }

            c.innerHTML = `
                <div class="card">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="avatar" style="width:52px;height:52px;background:var(--primary);color:#fff;font-size:20px;font-weight:800">${API.usuario.nombre.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')}</div>
                        <div>
                            <div style="font-weight:800;font-size:15px">${API.usuario.nombre}</div>
                            <div class="muted" style="text-transform:capitalize;font-size:12px">Rol: ${r}</div>
                            <div class="muted" style="font-size:11px">Servidor: ${d.servidor}</div>
                        </div>
                    </div>
                </div>
                ${quick}
                <div class="stats-grid">${stats.map(s => `<div class="stat"><div class="num">${s[1]}</div><div class="lbl">${s[3]}${s[2]}</div></div>`).join('')}</div>
                <div class="card"><h3>Próximos cultos conmemorativos</h3>${cultos || '<div class="empty"><div class="ico">🗓️</div>No hay cultos programados</div>'}</div>
            `;
        } catch (e) {
            c.innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`;
        }
    }

    // ================= SOLICITUDES =================
    async function renderSolicitudes() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="fab-row">
                <button class="btn btn-primary" onclick="App.nuevaSolicitud()">📜 Nueva solicitud</button>
                <button class="btn btn-outline" onclick="App.go('almas')">🕯️ Añadir antepasado</button>
            </div>
            <div class="chips" id="chip-sol">
                <button class="chip active" data-tipo="">Todas</button>
                ${TIPOS.map(t => `<button class="chip" data-tipo="${t}">${tipoName(t)}</button>`).join('')}
            </div>
            <div id="lista-sol"><div class="center muted">Cargando...</div></div>
        `;
        $('#chip-sol').addEventListener('click', e => {
            if (!e.target.classList.contains('chip')) return;
            c.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
            e.target.classList.add('active');
            cargarMisSolicitudes(e.target.dataset.tipo);
        });
        cargarMisSolicitudes('');
    }

    async function cargarMisSolicitudes(tipo) {
        const box = $('#lista-sol');
        try {
            const d = await API.misSolicitudes('', tipo);
            box.innerHTML = d.solicitudes.map(s => `
                <div class="card" onclick="App.detalleSolicitud(${s.id})">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <strong>${tipoName(s.tipo)}</strong>
                        ${badge(s.estado, s.fuera_plazo ? 'Fuera de plazo' : '')}
                    </div>
                    <div class="muted" style="font-size:12.5px">
                        🕯️ ${s.antepasado || 'Familiar / Genérico'}<br>
                        📅 Evento: ${s.fecha_evento} · Solicitada: ${s.fecha_solicitud}
                    </div>
                    ${s.primera_vez ? `<div style="margin-top:8px"><span class="badge warn">Primerizo · requiere orientación (UC12)</span></div>` : ''}
                </div>
            `).join('') || '<div class="empty"><div class="ico">📜</div>Aún no tienes solicitudes</div>';
        } catch (e) { box.innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    async function nuevaSolicitud() {
        let almas = [];
        try {
            const d = await API.antepasados();
            almas = d.antepasados;
        } catch (e) {}

        const almasOptions = almas.length
            ? almas.map(a => `<option value="${a.id}">${a.nombres}${a.aniversario ? ' (aniv. ' + a.aniversario + ')' : ''}</option>`).join('')
            : `<option value="">— Sin antepasados (agrégalos en Libro de Almas) —</option>`;

        openModal(`
            <h2>Nueva solicitud <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Los plazos de Nensai, Ireisai y Shinrei Saishi se validan contra el cronograma (regla RN02). Las solicitudes fuera de plazo pasan a estado <b>extemporáneo</b> (UC14).</div>
            <div class="field">
                <label>Tipo de servicio</label>
                <select id="sol-tipo" onchange="App.ajustarTipo()">
                    ${TIPOS.map(t => `<option value="${t}">${tipoName(t)}</option>`).join('')}
                </select>
            </div>
            <div class="field" id="sol-antepasado-wrap">
                <label>Antepasado (libro de almas)</label>
                <select id="sol-antepasado">${almasOptions}</select>
            </div>
            <div class="field">
                <label>Fecha del evento / conmemoración</label>
                <input type="date" id="sol-fecha" min="${new Date().toISOString().slice(0,10)}">
            </div>
            <div class="field">
                <label>Observaciones</label>
                <textarea id="sol-obs" placeholder="Datos adicionales para el encargado departamental..."></textarea>
            </div>
            <div id="sol-nota-eidai"></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarSolicitud()">Enviar solicitud</button>
            </div>
        `);
        ajustarTipo();
    }

    function ajustarTipo() {
        const tipo = $('#sol-tipo').value;
        const nota = $('#sol-nota-eidai');
        const wrap = $('#sol-antepasado-wrap');
        if (tipo === 'eidai') {
            wrap.style.display = 'none';
            nota.innerHTML = '<div class="meta-box">Eidai Saishi requiere la firma de 3 niveles (UC13): proponente, iglesia y región. Se generarán automáticamente al enviar.</div>';
        } else {
            wrap.style.display = '';
            nota.innerHTML = '';
        }
    }

    async function guardarSolicitud() {
        const tipo = $('#sol-tipo').value;
        const fecha = $('#sol-fecha').value;
        if (!fecha) { showBanner('Indica la fecha del evento'); return; }

        if (tipo !== 'eidai') {
            const ap = $('#sol-antepasado').value;
            if (!ap) { showBanner('Selecciona un antepasado del libro de almas'); return; }
        }

        try {
            const d = await API.solicitar({ tipo, antepasado_id: $('#sol-antepasado') ? $('#sol-antepasado').value : 0, fecha_evento: fecha, observaciones: $('#sol-obs').value });
            closeModal();
            showBanner(d.mensaje, d.fuera_plazo ? 'warn' : 'ok');
            setView('solicitudes');
        } catch (e) { showBanner(e.message); }
    }

    async function detalleSolicitud(id) {
        try {
            const d = await API.detalleSolicitud(id);
            const s = d.solicitud;
            let firmasHtml = '';
            if (d.firmas.length) {
                firmasHtml = `<div class="sig-index">${d.firmas.map(f => `
                    <div class="sig-item">
                        <div>
                            <div class="lvl">${f.nivel}</div>
                            <div class="muted" style="font-size:11.5px">${f.estado === 'firmado' ? '✅ Firmado por ' + (f.firmante || '—') + (f.fecha ? ' el ' + f.fecha : '') : f.estado === 'rechazado' ? '❌ Rechazado' + (f.observaciones ? ' · ' + f.observaciones : '') : '⏳ Pendiente'}</div>
                        </div>
                    </div>`).join('')}</div>`;
            }

            const acciones = [];
            if (can(['miembro', 'misionero', 'ministro', 'responsable', 'presidente', 'administrador']) &&
                s.solicitante_id === API.usuario.id && ['pendiente_validacion', 'extemporanea', 'observada'].includes(s.estado)) {
                acciones.push(`<button class="btn btn-outline btn-sm" onclick="App.editarSolicitud(${s.id})">✏️ Editar</button>`);
                if (s.estado === 'pendiente_validacion') {
                    acciones.push(`<button class="btn btn-red btn-sm" onclick="App.cancelarSolicitud(${s.id})">✖ Cancelar</button>`);
                }
            }

            openModal(`
                <h2>${tipoName(s.tipo)} <button class="close" onclick="App.cerrarModal()">✕</button></h2>
                <div style="margin-bottom:10px">${badge(s.estado, s.fuera_plazo ? 'Fuera de plazo' : '')} ${s.primera_vez ? '<span class="badge warn">Primerizo</span>' : ''}</div>
                <div class="meta-box">
                    Solicitud #${s.id}<br>
                    Solicitante: ${s.solicitante}<br>
                    Antepasado: ${s.antepasado || 'Familiar / Genérico'}<br>
                    Evento: ${s.fecha_evento} · Presentada: ${s.fecha_solicitud}<br>
                    ${s.observaciones ? 'Observaciones: ' + s.observaciones : ''}
                </div>
                ${firmasHtml}
                ${acciones.length ? `<div class="actions">${acciones.join('')}</div>` : ''}
            `);
        } catch (e) { showBanner(e.message); }
    }

    async function editarSolicitud(id) {
        try {
            const d = await API.detalleSolicitud(id);
            const s = d.solicitud;
            const almas = (await API.antepasados()).antepasados;
            openModal(`
                <h2>Editar solicitud <button class="close" onclick="App.cerrarModal()">✕</button></h2>
                <div class="field">
                    <label>Antepasado</label>
                    <select id="ed-antepasado">
                        <option value="">Selecciona...</option>
                        ${almas.map(a => `<option value="${a.id}" ${a.id == s.antepasado_id ? 'selected' : ''}>${a.nombres}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label>Fecha del evento</label>
                    <input type="date" id="ed-fecha" value="${s.fecha_evento}">
                </div>
                <div class="field">
                    <label>Observaciones</label>
                    <textarea id="ed-obs">${s.observaciones || ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="App.guardarEdit(${s.id})">Guardar</button>
                </div>
            `);
        } catch (e) { showBanner(e.message); }
    }

    async function guardarEdit(id) {
        try {
            const fecha = $('#ed-fecha').value;
            if (!fecha) { showBanner('Indica la fecha del evento'); return; }
            const d = await API.editarSolicitud(id, { fecha_evento: fecha, antepasado_id: $('#ed-antepasado').value || 0, observaciones: $('#ed-obs').value });
            closeModal();
            showBanner(d.mensaje, d.fuera_plazo ? 'warn' : 'ok');
            setView('solicitudes');
        } catch (e) { showBanner(e.message); }
    }

    async function cancelarSolicitud(id) {
        if (!confirm('¿Cancelar esta solicitud?')) return;
        try {
            await API.cancelarSolicitud(id);
            closeModal();
            showBanner('Solicitud cancelada', 'ok');
            setView('solicitudes');
        } catch (e) { showBanner(e.message); }
    }

    // ================= LIBRO DE ALMAS =================
    async function renderAlmas() {
        const c = $('#main-content');
        c.innerHTML = `<div class="center muted">Cargando...</div>`;
        try {
            const d = await API.antepasados();
            const lista = d.antepasados.map(a => `
                <div class="list-item">
                    <div class="avatar">🕯️</div>
                    <div class="info">
                        <div class="title">${a.nombres}</div>
                        <div class="sub">${a.parentesco || '—'}${a.aniversario ? ' · Aniversario: ' + a.aniversario : ''}${a.fecha_fallecimiento ? ' · Fallecido: ' + a.fecha_fallecimiento : ''}</div>
                    </div>
                </div>`).join('');

            c.innerHTML = `
                <div class="fab-row">
                    <button class="btn btn-primary" onclick="App.verFormAntepasado()">➕ Nuevo antepasado</button>
                </div>
                <div class="card"><h3>Mi libro de almas</h3>${lista || '<div class="empty"><div class="ico">🕯️</div>Registra a tus antepasados para poder solicitarlos en los cultos</div>'}</div>
            `;
        } catch (e) { c.innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    function verFormAntepasado() {
        openModal(`
            <h2>Nuevo antepasado <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Este registro alimenta tu libro de almas y habilita las solicitudes de culto conmemorativo (UC1).</div>
            <div class="field"><label>Nombres completos *</label><input id="ap-nombres" placeholder="Ej. María Pérez de La Cruz"></div>
            <div class="row">
                <div class="field"><label>Parentesco</label><input id="ap-parentesco" placeholder="Madre, abuelo..."></div>
                <div class="field"><label>Aniversario (MM-DD)</label><input id="ap-aniv" placeholder="08-15"></div>
            </div>
            <div class="field"><label>Fecha de fallecimiento</label><input type="date" id="ap-fech"> </div>
            <div class="field"><label>Notas</label><textarea id="ap-notas"></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarAntepasado()">Guardar</button>
            </div>
        `);
    }

    async function guardarAntepasado() {
        const nombres = $('#ap-nombres').value.trim();
        if (!nombres) { showBanner('El nombre es obligatorio'); return; }
        try {
            await API.crearAntepasado({
                nombres, parentesco: $('#ap-parentesco').value, aniversario: $('#ap-aniv').value,
                fecha_fallecimiento: $('#ap-fech').value, notas: $('#ap-notas').value
            });
            closeModal();
            showBanner('Antepasado registrado', 'ok');
            setView('almas');
        } catch (e) { showBanner(e.message); }
    }

    // ================= FALLECIMIENTO (UC9) =================
    async function renderFallecer() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="card">
                <h3>Registrar fallecimiento</h3>
                <div class="meta-box">El registro transfiere automáticamente los antecedentes a la Sede Nacional Santa Cruz (UC10 · RN09). Adjunta el certificado de defunción si lo tienes.</div>
                <div class="field"><label>Nombre de la persona fallecida *</label><input id="fal-nombres" placeholder="Nombres completos"></div>
                <div class="field"><label>CI</label><input id="fal-ci" placeholder="Número de carnet"></div>
                <div class="field">
                    <label>Certificado de defunción (imagen/PDF)</label>
                    <input type="file" id="fal-archivo" accept="image/*,application/pdf">
                    <div class="muted" style="font-size:11.5px;margin-top:4px">Solo se guarda una referencia local (máx. 250 KB). Si es ilegible, se alertará a la Secretaría.</div>
                </div>
                <button class="btn btn-primary btn-block" onclick="App.guardarFallecimiento()">⚰️ Registrar y transferir</button>
            </div>
            <div class="card"><h3>Registros enviados</h3><div id="fal-lista"><div class="center muted">Cargando...</div></div></div>
        `;

        $('#fal-archivo').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 250000) { showBanner('El archivo supera 250 KB — se registrará sin adjunto', 'warn'); e.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = () => { e.target.dataset.dataurl = reader.result; };
            reader.readAsDataURL(file);
        });

        try {
            const d = await API.listarFallecimientos();
            $('#fal-lista').innerHTML = d.fallecimientos.map(f => `
                <div class="list-item">
                    <div class="avatar">⚰️</div>
                    <div class="info">
                        <div class="title">${f.fallecido_nombres}</div>
                        <div class="sub">${f.ci ? 'CI ' + f.ci + ' · ' : ''}${f.creado_en}${f.alerta ? ' · Requiere verificación manual (Secretaría)' : ''}</div>
                    </div>
                    ${f.transferido ? '<span class="badge ok">Transferido</span>' : '<span class="badge gray">Pendiente</span>'}
                </div>`).join('') || '<div class="empty"><div class="ico">⚰️</div>Sin registros</div>';
        } catch (e) { $('#fal-lista').innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    async function guardarFallecimiento() {
        const nombres = $('#fal-nombres').value.trim();
        if (!nombres) { showBanner('El nombre de la persona fallecida es obligatorio'); return; }
        const archivo = $('#fal-archivo');
        try {
            const d = await API.registrarFallecimiento({ fallecido_nombres: nombres, ci: $('#fal-ci').value, certificado: archivo.dataset.dataurl || '' });
            showBanner(d.mensaje, 'ok');
            setView('fallecer');
        } catch (e) { showBanner(e.message); }
    }

    // ================= BANDEJA (UC7/UC8/UC14) =================
    async function renderBandeja() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="meta-box">Bandeja departamental: valida (UC7), aprueba (UC8), bloquea fuera de plazo (UC14) y registra/transfiere (UC10) solicitudes.</div>
            <div class="chips" id="chip-band">
                <button class="chip active" data-estado="pendiente_validacion,en_revision,extemporanea,observada">Pendientes</button>
                <button class="chip" data-estado="aprobada,registrada">Resueltas</button>
            </div>
            <div id="lista-band"><div class="center muted">Cargando...</div></div>
        `;
        $('#chip-band').addEventListener('click', e => {
            if (!e.target.classList.contains('chip')) return;
            c.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
            e.target.classList.add('active');
            cargarBandeja(e.target.dataset.estado);
        });
        cargarBandeja('pendiente_validacion,en_revision,extemporanea,observada');
    }

    async function cargarBandeja(estado) {
        const box = $('#lista-band');
        try {
            const d = await API.bandeja(estado);
            box.innerHTML = d.solicitudes.map(s => `
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <strong>${tipoName(s.tipo)} #${s.id}</strong>
                        ${badge(s.estado, s.fuera_plazo ? 'Fuera de plazo' : '')}
                    </div>
                    <div class="muted" style="font-size:12.5px;margin-bottom:8px">
                        Solicitante: ${s.solicitante}<br>
                        🕯️ ${s.antepasado || 'Familiar / Genérico'} · Evento: ${s.fecha_evento}
                        ${s.primera_vez ? '<br><span class="badge warn">Primerizo — requiere orientación (UC12)</span>' : ''}
                    </div>
                    <div class="actions">
                        ${s.estado === 'pendiente_validacion' || s.estado === 'extemporanea' ? `<button class="btn btn-outline btn-sm" onclick="App.accionValid('validar',${s.id})">✔️ Validar (UC7)</button>` : ''}
                        ${s.estado === 'en_revision' ? `<button class="btn btn-green btn-sm" onclick="App.accionValid('aprobar',${s.id})">✔️ Aprobar (UC8)</button>` : ''}
                        ${s.estado === 'aprobada' ? `<button class="btn btn-primary btn-sm" onclick="App.accionValid('registrar',${s.id})">🏛️ Registrar y transferir</button>` : ''}
                        ${s.estado !== 'aprobada' && s.estado !== 'registrada' ? `<button class="btn btn-gold btn-sm" onclick="App.accionValid('bloquear',${s.id})">🚫 Bloquear plazo (UC14)</button>` : ''}
                        <button class="btn btn-outline btn-sm" onclick="App.detalleSolicitud(${s.id})">🔍 Ver</button>
                    </div>
                </div>
            `).join('') || '<div class="empty"><div class="ico">📥</div>Sin solicitudes en esta bandeja</div>';
        } catch (e) { box.innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    async function accionValid(accion, id) {
        const etiquetas = { validar: 'validar', aprobar: 'aprobar', bloquear: 'bloquear (UC14)', registrar: 'registrar y transferir' };
        let observaciones = '';
        if (accion === 'bloquear') {
            observaciones = prompt('Motivo del bloqueo por fuera de plazo:');
            if (observaciones === null) return;
        }
        try {
            const d = await API.accionValidacion(accion, id, observaciones);
            showBanner(d.mensaje, 'ok');
            setView('bandeja');
        } catch (e) { showBanner(e.message); }
    }

    // ================= FIRMAS (UC13) =================
    async function renderFirmas() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="meta-box">Firmas de Eidai Saishi (UC13): se exigen 3 niveles — proponente, iglesia y región (RN06). Aquí se firmará el nivel correspondiente a tu rol.</div>
            <div class="card"><h3>Pendientes de mi firma</h3><div id="firmas-lista"><div class="center muted">Cargando...</div></div></div>
        `;
        try {
            const d = await API.firmasPendientes();
            $('#firmas-lista').innerHTML = d.firmas.map(f => `
                <div class="list-item">
                    <div class="avatar">✍️</div>
                    <div class="info">
                        <div class="title">${tipoName(f.tipo)} #${f.solicitud_id} <span class="badge gray">nivel ${f.nivel}</span></div>
                        <div class="sub">Solicitante: ${f.solicitante} · ${f.antepasado || 'Familiar / Genérico'} · ${f.fecha_evento}</div>
                    </div>
                    <button class="btn btn-sm btn-green" onclick="App.firmar(${f.solicitud_id},1)">Firmar</button>
                </div>`).join('') || '<div class="empty"><div class="ico">✍️</div>No hay firmas pendientes para tu nivel</div>';
        } catch (e) { $('#firmas-lista').innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    function firmar(solicitudId, aceptar) {
        let obs = '';
        if (!aceptar) {
            obs = prompt('Motivo del rechazo (la solicitud pasará a OBSERVADA):');
            if (obs === null) return;
        } else if (!confirm('¿Estampar tu firma como aval de esta solicitud Eidai Saishi?')) {
            return;
        }
        firmarProcesar(solicitudId, aceptar, obs);
    }

    async function firmarProcesar(solicitudId, aceptar, obs) {
        try {
            const d = await API.firmarEidai(solicitudId, aceptar, obs);
            showBanner(d.mensaje, aceptar ? 'ok' : 'warn');
            setView('firmas');
        } catch (e) { showBanner(e.message); }
    }

    // ================= ORIENTACIONES (UC12) =================
    async function renderOrientaciones() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="meta-box">UC12: los solicitantes primerizos deben recibir orientación del Ministro Responsable antes de avanzar el trámite.</div>
            <div class="card"><h3>Solicitantes por orientar</h3><div id="or-pend"><div class="center muted">Cargando...</div></div></div>
            <div class="card"><h3>Orientaciones dadas</h3><div id="or-hist"><div class="center muted">Cargando...</div></div></div>
        `;
        try {
            const nec = await API.orientacionesNecesarias();
            $('#or-pend').innerHTML = nec.solicitantes.map(s => `
                <div class="list-item">
                    <div class="avatar">🧭</div>
                    <div class="info">
                        <div class="title">${s.solicitante}</div>
                        <div class="sub">${s.solicitudes} solicitud(es) · primerizo</div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="App.formOrientar(${s.solicitante_id})">Orientar</button>
                </div>`).join('') || '<div class="empty"><div class="ico">✅</div>Sin solicitantes por orientar</div>';

            const hist = await API.orientaciones();
            $('#or-hist').innerHTML = hist.orientaciones.map(o => `
                <div class="list-item">
                    <div class="avatar">📝</div>
                    <div class="info">
                        <div class="title">${o.solicitante}</div>
                        <div class="sub">${o.fecha} · por ${o.ministro || '—'}</div>
                    </div>
                </div>`).join('') || '<div class="empty"><div class="ico">📝</div>Sin orientaciones</div>';
        } catch (e) {
            $('#or-pend').innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`;
        }
    }

    function formOrientar(solicitanteId) {
        openModal(`
            <h2>Registrar orientación <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Registra la orientación brindada al solicitante primerizo. Sin ella el flujo del trámite queda pendiente (UC12).</div>
            <div class="field"><label>Temas orientados</label><textarea id="or-contenido" placeholder="Explique el proceso, requisitos y significados de Senzo/Nensai/Eidai Saishi..."></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarOrientacion(${solicitanteId})">Guardar</button>
            </div>
        `);
    }

    async function guardarOrientacion(solicitanteId) {
        const contenido = $('#or-contenido').value.trim();
        if (!contenido) { showBanner('Escribe los temas orientados'); return; }
        try {
            await API.registrarOrientacion(solicitanteId, contenido);
            closeModal();
            showBanner('Orientación registrada (UC12)', 'ok');
            setView('orientaciones');
        } catch (e) { showBanner(e.message); }
    }

    // ================= CALENDARIO =================
    async function renderCalendario() {
        const c = $('#main-content');
        c.innerHTML = `<div class="center muted">Cargando...</div>`;
        try {
            const d = await API.proximosCultos();
            const puede = can(['responsable', 'presidente', 'administrador']);
            const lista = d.cultos.map(ck => `
                <div class="list-item">
                    <div class="avatar">🗓️</div>
                    <div class="info">
                        <div class="title">${tipoName(ck.tipo || 'Culto general')}</div>
                        <div class="sub">${ck.fecha} ${ck.hora ? '· ' + ck.hora : ''}${ck.lugar ? ' · ' + ck.lugar : ''}${ck.solicitante ? ' · ' + ck.solicitante : ''}</div>
                    </div>
                    ${puede ? `<button class="btn btn-sm btn-red" onclick="App.eliminarCulto(${ck.id})">✖</button>` : ''}
                </div>`).join('');

            c.innerHTML = `
                ${puede ? `<div class="fab-row"><button class="btn btn-primary" onclick="App.formProgramar()">➕ Programar culto</button></div>` : ''}
                <div class="card"><h3>Cultos conmemorativos programados</h3>${lista || '<div class="empty"><div class="ico">🗓️</div>No hay cultos programados</div>'}</div>
            `;
        } catch (e) { c.innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    async function formProgramar() {
        let sols = [];
        try {
            const d = await API.todasSolicitudes('', '');
            sols = d.solicitudes.filter(s => ['aprobada', 'registrada', 'en_revision'].includes(s.estado));
        } catch (e) {}
        openModal(`
            <h2>Programar culto <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="field">
                <label>Solicitud relacionada</label>
                <select id="cal-sol">
                    <option value="">Culto general (sin solicitud)</option>
                    ${sols.map(s => `<option value="${s.id}">${tipoName(s.tipo)} #${s.id} — ${s.solicitante} (${s.fecha_evento})</option>`).join('')}
                </select>
            </div>
            <div class="field"><label>Fecha del culto *</label><input type="date" id="cal-fecha"></div>
            <div class="row">
                <div class="field"><label>Hora</label><input type="time" id="cal-hora"></div>
                <div class="field"><label>Lugar</label><input id="cal-lugar" placeholder="Salón principal"></div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarCulto()">Programar</button>
            </div>
        `);
    }

    async function guardarCulto() {
        const fecha = $('#cal-fecha').value;
        if (!fecha) { showBanner('La fecha es obligatoria'); return; }
        try {
            await API.programarCulto({ solicitud_id: $('#cal-sol').value || 0, fecha, hora: $('#cal-hora').value, lugar: $('#cal-lugar').value });
            closeModal();
            showBanner('Culto programado', 'ok');
            setView('calendario');
        } catch (e) { showBanner(e.message); }
    }

    async function eliminarCulto(id) {
        if (!confirm('¿Eliminar este culto del calendario?')) return;
        try {
            await API.eliminarCulto(id);
            showBanner('Culto eliminado', 'ok');
            setView('calendario');
        } catch (e) { showBanner(e.message); }
    }

    // ================= REPORTES (UC11) =================
    async function renderReportes() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="fab-row">
                <button class="btn btn-primary" onclick="App.reporteDetalle()">📄 Detalle por tipo/estado</button>
            </div>
            <div id="rep-content"><div class="center muted">Cargando...</div></div>
        `;
        try {
            const r = await API.reporteConsolidado();
            $('#rep-content').innerHTML = `
                <div class="stats-grid">
                    <div class="stat"><div class="num">${r.total_solicitudes}</div><div class="lbl">Total solicitudes</div></div>
                    <div class="stat red"><div class="num">${r.fuera_plazo}</div><div class="lbl">Fuera de plazo</div></div>
                    <div class="stat gold"><div class="num">${r.primerizos}</div><div class="lbl">Primerizos</div></div>
                    <div class="stat"><div class="num">${r.cultos_proximos}</div><div class="lbl">Cultos próximos</div></div>
                    <div class="stat red"><div class="num">${r.fallecimientos}</div><div class="lbl">Fallecimientos</div></div>
                    <div class="stat gold"><div class="num">${r.firmas_pendientes}</div><div class="lbl">Firmas pendientes</div></div>
                </div>
                <div class="card"><h3>Solicitudes por tipo</h3>
                    <div>${r.por_tipo.map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${tipoName(x.tipo)}</span><b>${x.total}</b></div>`).join('')}</div>
                </div>
                <div class="card"><h3>Por estado</h3>
                    <div>${r.por_estado.map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${ESTADO_LBL[x.estado] || x.estado}</span><b>${x.total}</b></div>`).join('')}</div>
                </div>
                <div class="card"><h3>Actividad por mes</h3>
                    <div>${r.por_mes.map(m => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${m.mes}</span><b>${m.total}</b></div>`).join('')}</div>
                </div>
                <div class="card"><h3>Últimas solicitudes</h3>
                    <div>${r.recientes.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);gap:6px"><span style="font-size:12.5px">${tipoName(s.tipo)} · ${s.solicitante} <span class="muted">(${s.fecha_solicitud})</span></span>${badge(s.estado)}</div>`).join('') || 'Sin datos'}</div>
                </div>
            `;
        } catch (e) { $('#rep-content').innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    async function reporteDetalle() {
        openModal(`
            <h2>Reporte detallado <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="field">
                <label>Tipo de servicio</label>
                <select id="rep-tipo"><option value="">Todos</option>${TIPOS.map(t => `<option value="${t}">${tipoName(t)}</option>`).join('')}</select>
            </div>
            <div class="field">
                <label>Estado</label>
                <select id="rep-estado">
                    <option value="">Todos</option>
                    ${Object.keys(ESTADO_LBL).map(es => `<option value="${es}">${ESTADO_LBL[es]}</option>`).join('')}
                </select>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.mostrarDetalle()">Generar</button>
            </div>
        `);
    }

    async function mostrarDetalle() {
        const tipo = $('#rep-tipo').value;
        const estado = $('#rep-estado').value;
        closeModal();
        try {
            const d = await API.reporteListado(tipo, estado);
            $('#rep-content').innerHTML = `
                <div class="card"><h3>Detalle (${tipoName(tipo) || 'todos'} / ${ESTADO_LBL[estado] || 'todos'}) — ${d.solicitudes.length}</h3>
                    ${d.solicitudes.map(s => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
                            <span style="font-size:12.5px"><b>${tipoName(s.tipo)} #${s.id}</b> · ${s.solicitante}<br><span class="muted">🕯️ ${s.antepasado || '—'} · ${s.fecha_evento}</span></span>
                            ${badge(s.estado, s.fuera_plazo ? 'Fuera de plazo' : '')}
                        </div>`).join('') || '<div class="empty"><div class="ico">📊</div>Sin resultados</div>'}
                </div>
            `;
        } catch (e) { showBanner(e.message); }
    }

    // ================= CONFIG =================
    async function renderConfig() {
        const c = $('#main-content');
        c.innerHTML = `
            <div class="card">
                <h3>Mi sesión</h3>
                <div style="display:flex;align-items:center;gap:12px">
                    <div class="avatar" style="background:var(--primary);color:#fff;font-weight:800">${API.usuario.nombre.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')}</div>
                    <div>
                        <div style="font-weight:700">${API.usuario.nombre}</div>
                        <div class="muted" style="text-transform:capitalize">${API.usuario.rol} · @${API.usuario.username}</div>
                    </div>
                </div>
                <div style="margin-top:12px"><button class="btn btn-red" onclick="App.logout()">🚪 Cerrar sesión</button></div>
            </div>
            <div class="card">
                <h3>Telegram</h3>
                <div class="meta-box">Recibe notificaciones de tus trámites en Telegram. Abre el bot y envía <b>/vincular CODIGO</b> con el código de abajo.</div>
                <div id="cfg-telegram"><div class="center muted">Cargando...</div></div>
            </div>
            ${can(['administrador']) ? `
                <div class="card"><h3>Usuarios <button class="btn btn-sm btn-primary" style="margin:0" onclick="App.formUsuario()">➕</button></h3><div id="cfg-users"><div class="center muted">Cargando...</div></div></div>
                <div class="card"><h3>Cronogramas (RN02) <button class="btn btn-sm btn-primary" style="margin:0" onclick="App.formCronograma()">➕</button></h3><div id="cfg-cronos"><div class="center muted">Cargando...</div></div></div>
            ` : ''}
        `;

        try {
            const tg = await API.telegramEstado();
            $('#cfg-telegram').innerHTML = tg.vinculado
                ? `<div class="list-item">
                        <div class="avatar">✅</div>
                        <div class="info"><div class="title">Cuenta vinculada</div><div class="sub">Chat: ${tg.chat_id} · código ${tg.codigo}</div></div>
                    </div>`
                : `<div style="display:flex;align-items:center;gap:14px;padding:6px 0">
                        <div style="background:var(--primary);color:#fff;border-radius:10px;padding:10px 14px;font-size:18px;font-weight:800;letter-spacing:2px">${tg.codigo}</div>
                        <div style="font-size:12.5px;color:var(--muted)">Envía <b>/vincular ${tg.codigo}</b> al bot desde Telegram.</div>
                    </div>`;
        } catch (e) {
            $('#cfg-telegram').innerHTML = `<div class="banner warn">📌 ${e.message}</div>`;
        }

        if (can(['administrador'])) {
            try {
                const u = await API.listarUsuarios();
                $('#cfg-users').innerHTML = u.usuarios.map(us => `
                    <div class="list-item" style="flex-wrap:wrap">
                        <div class="avatar">👤</div>
                        <div class="info">
                            <div class="title">${us.nombre}</div>
                            <div class="sub">${us.email || us.username} · <span style="text-transform:capitalize">${us.rol}</span>${us.activo ? '' : ' · inactivo'}</div>
                        </div>
                        <div style="display:flex;gap:6px;align-items:center">
                            <select id="rol-${us.id}" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px">
                                ${['administrador', 'presidente', 'responsable', 'ministro', 'misionero', 'miembro', 'frecuentador']
                                    .map(r => `<option value="${r}" ${r === us.rol ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="App.cambiarRol('${us.id}')">OK</button>
                        </div>
                    </div>`).join('');

                const cr = await API.cronogramas();
                $('#cfg-cronos').innerHTML = cr.cronogramas.map(cc => `
                    <div class="list-item" onclick="App.formCronograma(${cc.id})">
                        <div class="avatar">🗓️</div>
                        <div class="info">
                            <div class="title">${tipoName(cc.tipo)} · ${cc.anio}</div>
                            <div class="sub">${cc.fecha_inicio || '—'} → ${cc.fecha_fin || '—'} · anticipación ${cc.dias_anticipacion} días</div>
                        </div>
                    </div>`).join('') || '<div class="empty">Sin cronogramas</div>';
            } catch (e) {
                $('#cfg-users').innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`;
                $('#cfg-cronos').innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`;
            }
        }
    }

    function formUsuario() {
        openModal(`
            <h2>Código de invitación <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="banner warn">Comparte este código. La persona crea su cuenta desde el inicio con "Crear cuenta con código".</div>
            <div class="field"><label>Para (descripción)</label><input id="u-nombre" placeholder="p.ej. Juan Pérez"></div>
            <div class="field"><label>Rol inicial</label>
                <select id="u-rol">
                    <option value="miembro">Miembro</option>
                    <option value="frecuentador">Frecuentador</option>
                    <option value="misionero">Misionero</option>
                    <option value="responsable">Dedicante Sector (responsable)</option>
                    <option value="presidente">Responsable de Iglesia</option>
                    <option value="ministro">Ministro Responsable</option>
                    <option value="administrador">Secretaría Sede Nacional</option>
                </select>
            </div>
            <div id="u-resultado"></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cerrar</button>
                <button class="btn btn-primary" onclick="App.guardarUsuario()">Generar código</button>
            </div>
        `);
    }

    async function guardarUsuario() {
        try {
            const d = await API.crearInvitacion({
                descripcion: $('#u-nombre').value, rol: $('#u-rol').value,
            });
            $('#u-resultado').innerHTML = `
                <div class="card" style="text-align:center;background:var(--primary);color:#fff">
                    <div style="font-size:12px;color:#e5e7eb">CÓDIGO</div>
                    <div style="font-size:32px;font-weight:800;letter-spacing:4px">${d.codigo}</div>
                </div>`;
        } catch (e) { showBanner(e.message); }
    }

    async function cambiarRol(usuarioId) {
        try {
            const rol = $('#rol-' + usuarioId).value;
            await API.asignarRol(usuarioId, rol);
            showBanner('Rol actualizado', 'ok');
            setView('config');
        } catch (e) { showBanner(e.message); }
    }

    async function formCronograma(id) {
        let cc = null;
        if (id) {
            try {
                const cr = await API.cronogramas();
                cc = cr.cronogramas.find(x => x.id === id);
            } catch (e) {}
        }
        openModal(`
            <h2>${id ? 'Editar cronograma' : 'Nuevo cronograma'} <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Periodo de recepción de solicitudes y días mínimos de anticipación (regla RN02). Fuera de este periodo la solicitud pasa a extemporánea (UC14).</div>
            <div class="row">
                <div class="field"><label>Tipo</label>
                    <select id="cr-tipo">
                        ${['nensai','ireisai','shinrei'].map(t => `<option value="${t}" ${cc && cc.tipo === t ? 'selected' : ''}>${tipoName(t)}</option>`).join('')}
                    </select>
                </div>
                <div class="field"><label>Año</label><input type="number" id="cr-anio" value="${cc ? cc.anio : new Date().getFullYear()}"></div>
            </div>
            <div class="row">
                <div class="field"><label>Inicio de recepción</label><input type="date" id="cr-ini" value="${cc ? cc.fecha_inicio : ''}"></div>
                <div class="field"><label>Fin de recepción</label><input type="date" id="cr-fin" value="${cc ? cc.fecha_fin : ''}"></div>
            </div>
            <div class="field"><label>Anticipación mínima (días)</label><input type="number" id="cr-dias" value="${cc ? cc.dias_anticipacion : 15}" min="1" max="365"></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarCronograma(${id || 0})">Guardar</button>
            </div>
        `);
    }

    async function guardarCronograma(id) {
        const d = { tipo: $('#cr-tipo').value, anio: $('#cr-anio').value, fecha_inicio: $('#cr-ini').value, fecha_fin: $('#cr-fin').value, dias_anticipacion: $('#cr-dias').value };
        try {
            if (id) await API.editarCronograma(id, d);
            else await API.crearCronograma(d);
            closeModal();
            showBanner('Cronograma guardado', 'ok');
            setView('config');
        } catch (e) { showBanner(e.message); }
    }

    // ================= UI GENÉRICA =================
    function logout() { API.logout(); }

    function toggleRegistro() {
        const c = $('#login-registro');
        const btn = $('#btn-registro');
        if (!c) return;
        const abrir = getComputedStyle(c).display === 'none';
        c.style.display = abrir ? 'flex' : 'none';
        if (btn) btn.textContent = abrir ? 'Cancelar' : 'Crear cuenta con código';
    }

    async function registrar() {
        const err = $('#login-error');
        if (err) err.innerHTML = '';
        try {
            await API.registrar({
                nombre: $('#rg-nombre').value.trim(),
                email: $('#rg-email').value.trim(),
                password: $('#rg-pass').value,
                codigo: $('#rg-codigo').value.trim(),
            });
            enterApp();
        } catch (ex) {
            if (err) err.innerHTML = '<div class="banner err">⚠️ ' + ex.message + '</div>';
        }
    }

    function cerrarModal() { closeModal(); }

    // ================= INIT =================
    function mountModal() {
        $('#modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    }

    async function init() {
        mountModal();
        $('#login-form').addEventListener('submit', async e => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Ingresando...';
            const err = $('#login-error');
            err.innerHTML = '';
            try {
                await API.login($('#login-user').value.trim(), $('#login-pass').value);
                enterApp();
            } catch (ex) {
                err.innerHTML = '<div class="banner err">⚠️ ' + ex.message + '</div>';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Ingresar';
            }
        });

        await API.ready();
        if (API.token && API.usuario) {
            enterApp();
        }
    }

    function enterApp() {
        $('#login-view').style.display = 'none';
        $('#app-view').style.display = 'block';
        $('#header-user').textContent = API.usuario.nombre.split(' ')[0][0].toUpperCase() + (API.usuario.nombre.split(' ')[1] ? API.usuario.nombre.split(' ')[1][0].toUpperCase() : '');
        setNav();
        setView('inicio');
    }

    return {
        init,
        go: v => setView(v),
        cerrarModal,
        ajustarTipo, nuevaSolicitud, guardarSolicitud, detalleSolicitud, editarSolicitud, guardarEdit, cancelarSolicitud,
        verFormAntepasado, guardarAntepasado,
        guardarFallecimiento,
        accionValid,
        firmar, firmarProcesar,
        formOrientar, guardarOrientacion,
        formProgramar, guardarCulto, eliminarCulto,
        reporteDetalle, mostrarDetalle,
        formUsuario, guardarUsuario, cambiarRol, formCronograma, guardarCronograma,
        logout, toggleRegistro, registrar,
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
window.App = App;