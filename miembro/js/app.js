const App = (() => {
    // ================= CONSTANTES =================
    const PILARES = ['oracion', 'cancion', 'alimentacion'];
    const PILAR_LBL = { oracion: 'Oración', cancion: 'Canción', alimentacion: 'Alimentación' };
    const PILAR_ICO = { oracion: '🙏', cancion: '🎵', alimentacion: '🍎' };
    const ESTADO_CLS = {
        nuevo: 'badge-warn', en_seguimiento: 'badge-neutral', estable: 'badge-ok', inactivo: 'badge-neutral',
    };
    const ESTADO_LBL = { nuevo: 'Nuevo', en_seguimiento: 'En Seguimiento', estable: 'Estable', inactivo: 'Inactivo' };

    const ROLES_DISC = ['administrador', 'presidente', 'ministro', 'responsable'];

    // ================= ESTADO =================
    let currentView = 'inicio';
    let currentTab = 'entrevistas';
    let currentMemberId = null;
    let perfilCache = null;

    // ================= DOM HELPERS =================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function can(roles) {
        return roles.includes(API.usuario?.rol);
    }

    function showToast(msg, tipo = '') {
        const t = $('#toast');
        t.textContent = msg;
        t.className = tipo ? 'show ' + tipo : 'show';
        clearTimeout(t._tm);
        t._tm = setTimeout(() => t.className = '', 2600);
    }

    function openModal(html) {
        $('#modal-content').innerHTML = html;
        $('#modal').classList.remove('hidden');
    }
    function cerrarModal() {
        $('#modal').classList.add('hidden');
        $('#modal-content').innerHTML = '';
    }

    function lvlDots(n, max = 5, color) {
        let html = '<div class="lvl-dots">';
        for (let i = 1; i <= max; i++) {
            html += `<span class="dot ${i <= n ? 'on' : ''}" style="${i <= n && color ? 'background:' + color : ''}"></span>`;
        }
        return html + '</div>';
    }

    function pilarColor(n) { return n >= 4 ? '#10b981' : n >= 3 ? '#f59e0b' : '#ef4444'; }

    function badgeEstado(estado) {
        return `<span class="${ESTADO_CLS[estado] || 'badge-neutral'}">${ESTADO_LBL[estado] || estado}</span>`;
    }

    // ================= NAVEGACIÓN =================
    function setNav() {
        const nav = $('#bottom-nav');
        const items = [];
        items.push(['inicio', '🏠', 'Inicio']);
        if (can(ROLES_DISC)) items.push(['miembros', '👥', 'Miembros']);
        items.push(['mio', '📌', 'Mi Plan']);
        if (can(ROLES_DISC)) items.push(['reportes', '📊', 'Reportes']);
        items.push(['config', '⚙️', 'Config']);
        nav.innerHTML = items.map(([v, ico, txt]) =>
            `<button class="nav-item ${v === currentView ? 'active' : ''}" onclick="App.go('${v}')">
                <span class="n-ico">${ico}</span><span class="n-txt">${txt}</span>
            </button>`).join('');
    }

    function setMenu() {
        const items = [];
        items.push(['inicio', '🏠', 'Inicio']);
        if (can(ROLES_DISC)) items.push(['miembros', '👥', 'Miembros']);
        items.push(['mio', '📌', 'Mi Plan']);
        if (can(ROLES_DISC)) {
            items.push(['reportes', '📊', 'Reportes']);
            items.push(['config', '⚙️', 'Config']);
        }
        $('#menu-nav').innerHTML = items.map(([v, ico, txt]) =>
            `<button class="menu-item ${v === currentView ? 'active' : ''}" onclick="App.go('${v}')">
                <span class="ico">${ico}</span>${txt}
            </button>`).join('');
        if (can(['administrador'])) {
            $('#menu-nav').innerHTML += `<button class="menu-item" onclick="App.go('usuarios')"><span class="ico">👤</span>Usuarios</button>`;
        }
    }

    function toggleMenu() {
        const show = $('#side-menu').classList.toggle('show');
        $('#menu-overlay').classList.toggle('show', show);
    }

    function go(view) {
        currentView = view;
        setNav();
        setMenu();
        toggleMenu();
        window.scrollTo(0, 0);
        $('#fab').style.display = can(ROLES_DISC) ? 'flex' : 'none';
        $('#fab-menu').classList.add('hidden');
        switch (view) {
            case 'inicio': renderInicio(); break;
            case 'miembros': renderMiembros(); break;
            case 'mio': renderMiPlan(); break;
            case 'reportes': renderReportes(); break;
            case 'config': renderConfig(); break;
            case 'usuarios': renderUsuarios(); break;
            default: renderInicio();
        }
    }

    function setTitle(t) { $('#app-title').textContent = t; }

    // ================= INICIO =================
    async function renderInicio() {
        setTitle('Inicio');
        const c = $('#main-content');
        c.innerHTML = `<div class="center muted">Cargando...</div>`;
        try {
            if (can(ROLES_DISC)) {
                const d = await API.dashboard();
                c.innerHTML = `
                    <div class="stats-grid">
                        <div class="stat"><div class="num">${d.total_miembros}</div><div class="lbl">Miembros</div></div>
                        <div class="stat accent"><div class="num">${d.planes_activos}</div><div class="lbl">Planes activos</div></div>
                        <div class="stat gold"><div class="num">${d.visitas_mes}</div><div class="lbl">Visitas (mes)</div></div>
                        <div class="stat"><div class="num">${d.estudios_mes}</div><div class="lbl">Estudios (mes)</div></div>
                        <div class="stat red"><div class="num">${d.lecturas_pendientes}</div><div class="lbl">Lecturas pend.</div></div>
                        <div class="stat accent"><div class="num">${d.total_activos}</div><div class="lbl">Activos</div></div>
                    </div>
                    <div class="card">
                        <h3>📈 Miembros por estado</h3>
                        <div>${d.por_estado.map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${ESTADO_LBL[x.estado] || x.estado}</span><b>${x.total}</b></div>`).join('') || 'Sin datos'}</div>
                    </div>
                    <div class="card">
                        <h3>🕓 Actividad reciente</h3>
                        ${d.recientes.map(m => `
                            <div class="list-item" onclick="App.verMiembro(${m.id})">
                                <div class="avatar">${initials(m.nombre)}</div>
                                <div class="info">
                                    <div class="title">${m.nombre}</div>
                                    <div class="sub">${m.ultima_actividad || m.fecha_ingreso}</div>
                                </div>
                                ${badgeEstado(m.estado)}
                            </div>`).join('') || '<div class="empty">Sin actividad registrada</div>'}
                    </div>
                `;
            } else {
                const mis = await API.miActividad();
                c.innerHTML = `
                    <div class="card">
                        <h3>🙏 Tus tres columnas de salvación</h3>
                        <div class="meta-box">Actividades de tu plan de seguimiento personal. Registra tu cumplimiento cada día.</div>
                        ${mis.actividades.map(a => `
                            <div class="pilar-range">
                                <div class="pilar-title">${PILAR_ICO[a.pilar]} ${PILAR_LBL[a.pilar]} · <span style="font-size:12px;color:var(--muted)">${a.frecuencia}</span></div>
                                <div style="font-size:13.5px;margin-bottom:8px">${a.actividad}</div>
                                ${a.meta ? `<div class="muted" style="margin-bottom:8px">🎯 ${a.meta}</div>` : ''}
                                <div style="display:flex;gap:8px">
                                    <button class="btn btn-sm ${a.cumplidos > 0 ? 'btn-primary' : 'btn-outline'} onclick="App.registrarProgreso(${a.id},1)">✅ Cumplido</button>
                                    <button class="btn btn-sm btn-outline" onclick="App.verRegistros(${a.id},'${a.actividad.replace(/'/g, "\\'")}')">Ver ${a.cumplidos || 0}</button>
                                </div>
                            </div>`).join('') || '<div class="empty">Aún no tienes plan asignado. Tu responsable lo creará tras tu primera entrevista.</div>'}
                    </div>
                `;
            }
        } catch (e) { c.innerHTML = `<div class="banner err">⚠️ ${e.message}</div>`; }
    }

    function initials(nombre) {
        return (nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    }

    // ================= MIEMBROS =================
    async function renderMiembros() {
        if (!can(ROLES_DISC)) { go('mio'); return; }
        setTitle('Miembros');
        const c = $('#main-content');
        c.innerHTML = `
            <div class="field"><input id="b-filtro" placeholder="🔍 Buscar miembro..." oninput="App.refreshMiembros()"></div>
            <div id="lista-miembros"><div class="center muted">Cargando...</div></div>
        `;
        await refreshMiembros();
    }

    async function refreshMiembros() {
        try {
            const filtro = $('#b-filtro')?.value || '';
            const d = await API.membersFiltro(filtro, '');
            const box = $('#lista-miembros');
            box.innerHTML = d.miembros.map(m => `
                <div class="card" style="cursor:pointer" onclick="App.verMiembro(${m.usuario_id})">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="avatar">${initials(m.nombre)}</div>
                        <div style="flex:1">
                            <div style="font-weight:700">${m.nombre}</div>
                            <div class="muted">${m.sector || 'Sin sector'} · ${badgeEstado(m.estado)}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:22px;margin-top:11px;flex-wrap:wrap">
                        ${PILARES.map(p => `
                            <div style="text-align:center">
                                <div style="font-size:10.5px;color:var(--muted)">${PILAR_ICO[p]} ${PILAR_LBL[p]}</div>
                                ${lvlDots(m[p], 5, pilarColor(m[p]))}
                            </div>`).join('')}
                    </div>
                    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
                        <span class="badge-neutral">🗣 ${m.n_entrevistas}</span>
                        <span class="badge-neutral">🏠 ${m.n_visitas}</span>
                        <span class="badge-neutral">📚 ${m.n_estudios}</span>
                        ${m.lecturas_pendientes > 0 ? `<span class="badge-warn">📖 ${m.lecturas_pendientes} lect.</span>` : ''}
                        ${m.planes_activos > 0 ? `<span class="badge-ok">📋 plan</span>` : ''}
                    </div>
                </div>`).join('') || '<div class="empty"><div class="ico">👥</div>Sin miembros</div>';
        } catch (e) { $('#lista-miembros').innerHTML = `<div class="center muted">⚠️ ${e.message}</div>`; }
    }

    // ================= PERFIL DE MIEMBRO =================
    async function verMiembro(id) {
        currentMemberId = id;
        currentTab = 'entrevistas';
        setTitle('Miembro');
        const c = $('#main-content');
        c.innerHTML = `<div class="center muted">Cargando...</div>`;
        await renderPerfil();
    }

    async function renderPerfil() {
        const c = $('#main-content');
        try {
            const d = await API.memberPerfil(currentMemberId);
            const p = d.perfil;
            c.innerHTML = `
                <div class="card">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="avatar" style="width:54px;height:54px;font-size:20px">${initials(p.nombre)}</div>
                        <div style="flex:1">
                            <div style="font-weight:800;font-size:16px">${p.nombre}</div>
                            <div class="muted">@${p.username} · ${p.sector || 'sin sector'}</div>
                            <div style="margin-top:5px">${badgeEstado(p.estado)}</div>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="App.entrevistaModal(${p.usuario_id},${p.perfil_id || 0})">🗣 Entrevista</button>
                    </div>
                    <div style="display:flex;gap:22px;margin-top:13px">
                        ${PILARES.map(x => `
                            <div style="text-align:center">
                                <div style="font-size:18px">${PILAR_ICO[x]}</div>
                                <div style="font-size:18px;font-weight:800;color:${pilarColor(p.niveles[x])}">${p.niveles[x]}</div>
                                <div style="font-size:10px;color:var(--muted)">${PILAR_LBL[x]}</div>
                            </div>`).join('')}
                        <div style="text-align:center;margin-left:auto">
                            <div style="font-size:22px;font-weight:800;color:${pilarColor(p.niveles.promedio)}">${p.niveles.promedio}</div>
                            <div style="font-size:10px;color:var(--muted)">Promedio</div>
                        </div>
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab ${currentTab === 'entrevistas' ? 'active' : ''}" onclick="App.tabPerfil('entrevistas')">🗣 Entrev</button>
                    <button class="tab ${currentTab === 'plan' ? 'active' : ''}" onclick="App.tabPerfil('plan')">📋 Plan</button>
                    <button class="tab ${currentTab === 'estudios' ? 'active' : ''}" onclick="App.tabPerfil('estudios')">📚 Estudios</button>
                    <button class="tab ${currentTab === 'lecturas' ? 'active' : ''}" onclick="App.tabPerfil('lecturas')">📖 Lect.</button>
                    <button class="tab ${currentTab === 'visitas' ? 'active' : ''}" onclick="App.tabPerfil('visitas')">🏠 Visitas</button>
                </div>
                <div id="perfil-detalle"></div>
            `;
            perfilCache = d;
            await renderTab();
        } catch (e) { c.innerHTML = `<div class="center muted">⚠️ ${e.message}</div>`; }
    }

    async function tabPerfil(tab) {
        currentTab = tab;
        await renderPerfil();
    }

    function renderTab() {
        const d = perfilCache;
        const box = $('#perfil-detalle');
        const pid = d.perfil.perfil_id;
        switch (currentTab) {
            case 'entrevistas':
                box.innerHTML = `
                    <div class="card">
                        <h3>🗣 Entrevistas ${can(ROLES_DISC) ? `<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.entrevistaModal(${d.perfil.usuario_id},0)">➕</button>` : ''}</h3>
                        ${d.entrevistas.map(e => `
                            <div class="list-item">
                                <div class="avatar">${e.tipo === 'inicial' ? '📋' : '🗣'}</div>
                                <div class="info">
                                    <div class="title">${e.tipo === 'inicial' ? 'Entrevista inicial' : 'Seguimiento'} · ${e.fecha}</div>
                                    <div class="sub">por ${e.entrevistador}</div>
                                </div>
                                <div style="text-align:right;font-size:12px;font-weight:700">
                                    <div style="color:${pilarColor(e.nivel_oracion)}">🙏 ${e.nivel_oracion}</div>
                                    <div style="color:${pilarColor(e.nivel_cancion)}">🎵 ${e.nivel_cancion}</div>
                                    <div style="color:${pilarColor(e.nivel_alimentacion)}">🍎 ${e.nivel_alimentacion}</div>
                                </div>
                            </div>`).join('') || '<div class="empty">Sin entrevistas registradas</div>'}
                    </div>`;
                break;
            case 'plan':
                box.innerHTML = `
                    <div class="card">
                        <h3>📋 Plan de seguimiento ${can(ROLES_DISC) ? `<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.planModal(${d.perfil.usuario_id})">➕ Plan</button>` : ''}</h3>
                        ${d.planes.map(pl => `
                            <div class="pilar-range">
                                <div class="pilar-title">Plan #${pl.id} · ${pl.fecha_inicio} ${pl.fecha_fin ? '→ ' + pl.fecha_fin : ''} · ${badgeEstado(pl.estado)}</div>
                                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                                    <div style="flex:1;height:8px;background:var(--border);border-radius:4px"><div style="height:8px;width:${pl.cumplimiento}%;background:var(--accent);border-radius:4px"></div></div>
                                    <span style="font-size:12px;font-weight:800">${pl.cumplimiento}%</span>
                                </div>
                                ${pl.actividades.map(a => `
                                    <div style="padding:7px 0;border-top:1px solid var(--border)">
                                        <div style="display:flex;justify-content:space-between;gap:6px">
                                            <span>${PILAR_ICO[a.pilar]} ${a.actividad}</span>
                                            <span class="${a.estado === 'completada' ? 'badge-ok' : 'badge-neutral'}" style="text-transform:capitalize">${a.frecuencia}</span>
                                        </div>
                                        ${a.meta ? `<div class="muted" style="font-size:11px">🎯 ${a.meta}</div>` : ''}
                                    </div>`).join('')}
                            </div>`).join('') || '<div class="empty">Sin plan asignado</div>'}
                    </div>`;
                break;
            case 'estudios':
                box.innerHTML = `
                    <div class="card"><h3>📚 Estudios ${can(ROLES_DISC) ? `<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.estudioModal(${d.perfil.usuario_id})">➕</button>` : ''}</h3>
                        ${d.estudios.map(es => `
                            <div class="list-item">
                                <div class="avatar">📘</div>
                                <div class="info"><div class="title">${es.tema}</div><div class="sub">${es.fecha} · ${es.duracion_min} min · ${es.instructor}</div></div>
                            </div>`).join('') || '<div class="empty">Sin estudios registrados</div>'}
                    </div>`;
                break;
            case 'lecturas':
                box.innerHTML = `
                    <div class="card"><h3>📖 Lecturas asignadas ${can(ROLES_DISC) ? `<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.lecturaModal(${d.perfil.usuario_id})">➕</button>` : ''}</h3>
                        ${d.lecturas.map(l => `
                            <div class="list-item">
                                <div class="avatar">📖</div>
                                <div class="info">
                                    <div class="title">${l.titulo}</div>
                                    <div class="sub">${l.autor || '—'} · asignada ${l.fecha_asignada} ${l.fecha_completada ? '· leída ' + l.fecha_completada : ''}</div>
                                </div>
                                <span class="${l.estado === 'completada' ? 'badge-ok' : l.estado === 'pendiente' ? 'badge-warn' : 'badge-neutral'}">${ESTADO_LBL2(l.estado)}</span>
                            </div>`).join('') || '<div class="empty">Sin lecturas asignadas</div>'}
                    </div>`;
                break;
            case 'visitas':
                box.innerHTML = `
                    <div class="card"><h3>🏠 Visitas ${can(ROLES_DISC) ? `<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.visitaModal(${d.perfil.usuario_id})">➕</button>` : ''}</h3>
                        ${d.visitas.map(v => `
                            <div class="list-item">
                                <div class="avatar">🏠</div>
                                <div class="info"><div class="title" style="text-transform:capitalize">${v.tipo}</div><div class="sub">${v.fecha} · por ${v.visitador}${v.motivo ? ' · ' + v.motivo : ''}</div></div>
                            </div>`).join('') || '<div class="empty">Sin visitas registradas</div>'}
                    </div>`;
                break;
        }
    }

    function ESTADO_LBL2(e) { return { pendiente: 'Pendiente', en_progreso: 'En Progreso', completada: 'Completada' }[e] || e; }

    // ================= MODALES =================
    function entrevistaModal(usuarioId, perfilId) {
        openModal(`
            <h2>🎙 Entrevista <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Evalúa los tres pilares del 1 al 5 (5 = excelente). Tras la primera entrevista el miembro pasa a "En Seguimiento" y se sugiere un plan personalizado.</div>
            <div class="row">
                <div class="field"><label>Tipo</label>
                    <select id="ent-tipo"><option value="seguimiento">Seguimiento</option><option value="inicial">Inicial</option></select>
                </div>
                <div class="field"><label>Fecha</label><input type="date" id="ent-fecha" value="${today()}"></div>
            </div>
            ${pilarSlider('oracion', 3)}
            ${pilarSlider('cancion', 3)}
            ${pilarSlider('alimentacion', 3)}
            <div class="field"><label>Observaciones</label><textarea id="ent-obs" rows="3" placeholder="Notas de la entrevista..."></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarEntrevista(${usuarioId},${perfilId})">Guardar</button>
            </div>
        `);
    }

    function pilarSlider(pilar, val) {
        return `
            <div class="pilar-range">
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span class="pilar-title" style="margin:0">${PILAR_ICO[pilar]} ${PILAR_LBL[pilar]}</span>
                    <span class="range-val" id="pv-${pilar}">${val}</span>
                </label>
                <input type="range" min="1" max="5" value="${val}" oninput="App.pilarVal('${pilar}',this.value)">
            </div>`;
    }

    function pilarVal(pilar, v) { $('#pv-' + pilar).textContent = v; }

    function today() { return new Date().toISOString().slice(0, 10); }

    async function guardarEntrevista(usuarioId, perfilId) {
        try {
            const d = await API.registrarEntrevista({
                usuario_id: usuarioId, perfil_id: perfilId, tipo: $('#ent-tipo').value,
                fecha: $('#ent-fecha').value, nivel_oracion: +$('#pv-oracion').textContent,
                nivel_cancion: +$('#pv-cancion').textContent, nivel_alimentacion: +$('#pv-alimentacion').textContent,
                observaciones: $('#ent-obs').value,
            });
            cerrarModal();
            showToast(d.mensaje, 'ok');
            await renderPerfil();
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= VISITA MODAL =================
    function visitaModal(usuarioId) {
        openModal(`
            <h2>🏠 Nueva visita <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="row">
                <div class="field"><label>Tipo</label>
                    <select id="v-tipo"><option value="domicilio">Domicilio</option><option value="hospital">Hospital</option><option value="escuela">Escuela</option><option value="otra">Otra</option></select>
                </div>
                <div class="field"><label>Fecha</label><input type="date" id="v-fecha" value="${today()}"></div>
            </div>
            <div class="field"><label>Motivo</label><input id="v-motivo" placeholder="Motivo / objetivo de la visita"></div>
            <div class="field"><label>Observaciones</label><textarea id="v-obs" rows="3" placeholder="Resultados, hallazgos..."></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarVisita(${usuarioId})">Guardar</button>
            </div>
        `);
    }
    async function guardarVisita(usuarioId) {
        try {
            const d = await API.registrarVisita({ usuario_id: usuarioId, tipo: $('#v-tipo').value, fecha: $('#v-fecha').value, motivo: $('#v-motivo').value, observaciones: $('#v-obs').value });
            cerrarModal(); showToast(d.mensaje, 'ok'); await renderPerfil();
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= ESTUDIO MODAL =================
    function estudioModal(usuarioId) {
        openModal(`
            <h2>📚 Sesión de estudio <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="field"><label>Tema *</label><input id="es-tema" placeholder="Tema de enseñanza"></div>
            <div class="row">
                <div class="field"><label>Fecha</label><input type="date" id="es-fecha" value="${today()}"></div>
                <div class="field"><label>Duración (min)</label><input type="number" id="es-min" value="60" min="10"></div>
            </div>
            <div class="field"><label>Notas</label><textarea id="es-obs" rows="3" placeholder="Resumen / avance del miembro..."></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarEstudio(${usuarioId})">Guardar</button>
            </div>
        `);
    }
    async function guardarEstudio(usuarioId) {
        try {
            const d = await API.registrarEstudio({ usuario_id: usuarioId, tema: $('#es-tema').value, fecha: $('#es-fecha').value, duracion_min: +$('#es-min').value, notas: $('#es-obs').value });
            cerrarModal(); showToast(d.mensaje, 'ok'); await renderPerfil();
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= LECTURA MODAL =================
    function lecturaModal(usuarioId) {
        openModal(`
            <h2>📖 Asignar lectura <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="field"><label>Título *</label><input id="l-titulo" placeholder="Título de la enseñanza/lectura"></div>
            <div class="row">
                <div class="field"><label>Autor</label><input id="l-autor" placeholder="Autor"></div>
                <div class="field"><label>Fecha</label><input type="date" id="l-fecha" value="${today()}"></div>
            </div>
            <div class="field"><label>Notas</label><textarea id="l-notas" rows="3" placeholder="Instrucciones..."></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarLectura(${usuarioId})">Asignar</button>
            </div>
        `);
    }
    async function guardarLectura(usuarioId) {
        try {
            const d = await API.asignarLectura({ usuario_id: usuarioId, titulo: $('#l-titulo').value, autor: $('#l-autor').value, fecha_asignada: $('#l-fecha').value, notas: $('#l-notas').value });
            cerrarModal(); showToast(d.mensaje, 'ok'); await renderPerfil();
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= PLAN MODAL =================
    function planModal(usuarioId) {
        openModal(`
            <h2>📋 Plan personalizado <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Define una actividad por cada pilar (Oración, Canción, Alimentación). Se sugiere una según el nivel actual del miembro; puedes editarla.</div>
            <label style="font-weight:600;font-size:12.5px">🙏 Oración</label>
            <input id="act-oracion" style="margin:4px 0 10px;width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px" value="Oración personal diaria (5 minutos matutina)">
            <label style="font-weight:600;font-size:12.5px">🎵 Canción</label>
            <input id="act-cancion" style="margin:4px 0 10px;width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px" value="Aprender 1 canción de alabanza semanal">
            <label style="font-weight:600;font-size:12.5px">🍎 Alimentación (espiritual)</label>
            <input id="act-alimentacion" style="margin:4px 0 10px;width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px" value="Estudio de la Palabra 3 veces por semana (15 min)">
            <div class="field"><label>Frecuencia</label>
                <select id="plan-freq"><option value="diaria">Diaria</option><option value="semanal" selected>Semanal</option><option value="mensual">Mensual</option></select>
            </div>
            <div class="row">
                <div class="field"><label>Inicio</label><input type="date" id="plan-ini" value="${today()}"></div>
                <div class="field"><label>Fin (opcional)</label><input type="date" id="plan-fin"></div>
            </div>
            <div class="field"><label>Notas del plan</label><textarea id="plan-notas" rows="2" placeholder="Objetivos del plan..."></textarea></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.guardarPlan(${usuarioId})">Crear plan</button>
            </div>
        `);
    }
    async function guardarPlan(usuarioId) {
        try {
            const freq = $('#plan-freq').value;
            const d = await API.crearPlan({
                usuario_id: usuarioId, fecha_inicio: $('#plan-ini').value, fecha_fin: $('#plan-fin').value,
                notas: $('#plan-notas').value,
                actividades: PILARES.map(p => ({ pilar: p, actividad: $('#act-' + p).value, frecuencia: freq })),
            });
            cerrarModal(); showToast(d.mensaje, 'ok'); await renderPerfil();
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= MI PLAN (miembro) =================
    async function renderMiPlan() {
        setTitle('Mi Plan');
        const c = $('#main-content');
        c.innerHTML = `<div class="center muted">Cargando...</div>`;
        try {
            const mis = await API.miActividad();
            c.innerHTML = `
                <div class="card">
                    <h3>🙏 Tus tres columnas de salvación</h3>
                    <div class="meta-box">Oración · Canción · Alimentación. Registra tu práctica diaria. Tu responsable dará seguimiento.</div>
                    ${mis.actividades.map(a => `
                        <div class="pilar-range">
                            <div class="pilar-title">${PILAR_ICO[a.pilar]} ${PILAR_LBL[a.pilar]} <span style="text-transform:capitalize;font-size:11px;color:var(--muted)">· ${a.frecuencia}</span></div>
                            <div style="font-size:14px;margin-bottom:6px">${a.actividad}</div>
                            ${a.meta ? `<div class="muted" style="margin-bottom:8px">🎯 ${a.meta}</div>` : ''}
                            <div style="display:flex;gap:8px;margin-bottom:8px">
                                <button class="btn btn-sm btn-primary" onclick="App.registrarProgreso(${a.id},1)">✅ Hoy</button>
                                <button class="btn btn-sm btn-outline" onclick="App.registrarProgreso(${a.id},0)">❌ No</button>
                            </div>
                            ${a.registros.length ? `<div class="muted" style="font-size:11.5px">Últimos: ${a.registros.map(r => (r.cumplido ? '✅' : '❌') + ' ' + r.fecha).slice(0, 5).join(' · ')}</div>` : ''}
                        </div>`).join('') || '<div class="empty"><div class="ico">📋</div>No tienes plan aún. Se creará tras tu primera entrevista.</div>'}
                </div>
            `;
        } catch (e) { c.innerHTML = `<div class="center muted">⚠️ ${e.message}</div>`; }
    }

    async function registrarProgreso(actividadId, cumplido) {
        try {
            const d = await API.registrarProgreso({ actividad_id: actividadId, cumplido });
            showToast(d.mensaje, 'ok');
            renderMiPlan();
        } catch (e) { showToast(e.message, 'err'); }
    }

    function verRegistros(actividadId, actividad) {
        openModal(`<h2>📅 Registros <button class="close" onclick="App.cerrarModal()">✕</button></h2><div class="meta-box">${actividad}</div><div class="center muted">Datos almacenados localmente. Consulta tu plan para el historial completo.</div>`);
    }

    // ================= REPORTES =================
    async function renderReportes() {
        if (!can(ROLES_DISC)) { go('inicio'); return; }
        setTitle('Reportes');
        const c = $('#main-content');
        c.innerHTML = `<div class="center muted">Cargando...</div>`;
        try {
            const r = await API.reporte();
            c.innerHTML = `
                <div class="stats-grid">
                    <div class="stat"><div class="num">${r.total}</div><div class="lbl">Miembros</div></div>
                    <div class="stat accent"><div class="num">${r.planes_activos}</div><div class="lbl">Planes activos</div></div>
                    <div class="stat gold"><div class="num">${r.total_visitas}</div><div class="lbl">Visitas</div></div>
                    <div class="stat"><div class="num">${r.total_estudios}</div><div class="lbl">Estudios</div></div>
                    <div class="stat accent"><div class="num">${r.lecturas_completadas}</div><div class="lbl">Lect. complet.</div></div>
                </div>
                <div class="card"><h3>Pilares (promedio)</h3>
                    <div>${PILARES.map(p => `
                        <div style="padding:7px 0;border-bottom:1px solid var(--border)">
                            <div style="display:flex;justify-content:space-between"><span>${PILAR_ICO[p]} ${PILAR_LBL[p]}</span><b style="color:${pilarColor(r.promedio_pilares[p])}">${r.promedio_pilares[p]}</b></div>
                            ${lvlDots(Math.round(r.promedio_pilares[p]), 5, pilarColor(r.promedio_pilares[p]))}
                        </div>`).join('')}</div>
                </div>
                <div class="card"><h3>Miembros por estado</h3>
                    <div>${r.por_estado.map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${ESTADO_LBL[x.estado] || x.estado}</span><b>${x.total}</b></div>`).join('')}</div>
                </div>
                <div class="card"><h3>Visitas por mes (6)</h3>
                    <div>${r.por_mes.map(m => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${m.mes}</span><b>${m.total}</b></div>`).join('') || 'Sin datos'}</div>
                </div>
            `;
        } catch (e) { c.innerHTML = `<div class="center muted">⚠️ ${e.message}</div>`; }
    }

    // ================= CONFIG =================
    function renderConfig() {
        setTitle('Configuración');
        const c = $('#main-content');
        const u = API.usuario;
        c.innerHTML = `
            <div class="card">
                <h3>👤 Mi sesión</h3>
                <div style="display:flex;align-items:center;gap:12px">
                    <div class="avatar" style="font-size:18px">${initials(u.nombre)}</div>
                    <div><div style="font-weight:700">${u.nombre}</div><div class="muted" style="text-transform:capitalize">${u.rol}${u.sector ? ' · ' + u.sector : ''} · @${u.username}</div></div>
                </div>
                ${can(ROLES_DISC) ? `<button class="btn btn-sm btn-outline" style="margin-top:12px" onclick="App.entrevistaModal(${u.id},0)">🗣 Registrar mi entrevista</button>` : ''}
            </div>
        `;
    }

    // ================= USUARIOS =================
    async function renderUsuarios() {
        if (!can(['administrador'])) { go('config'); return; }
        setTitle('Usuarios');
        const c = $('#main-content');
        c.innerHTML = `
            <button class="btn btn-primary" style="margin-bottom:14px" onclick="App.formInvitacion()">➕ Generar código de invitación</button>
            <div class="meta-box">Los miembros crean su propia cuenta con el código. Aquí puedes cambiar su rol.</div>
            <div id="lst-usuarios"><div class="center muted">Cargando...</div></div>
        `;
        try {
            const d = await API.listarUsuarios();
            const roles = ['administrador', 'presidente', 'responsable', 'ministro', 'misionero', 'miembro', 'frecuentador'];
            $('#lst-usuarios').innerHTML = d.usuarios.map(u => `
                <div class="card">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="avatar">${initials(u.nombre)}</div>
                        <div style="flex:1"><div style="font-weight:700">${u.nombre}</div><div class="muted">${u.email || u.username}${u.sector ? ' · ' + u.sector : ''}${u.activo ? '' : ' · INACTIVO'}</div></div>
                        <span class="${u.activo ? 'badge-ok' : 'badge-danger'}">${u.activo ? 'activo' : 'inactivo'}</span>
                    </div>
                    <div class="row" style="margin-top:10px;align-items:end">
                        <div class="field" style="margin:0"><label>Rol</label>
                            <select id="rol-${u.id}">${roles.map(r => `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${r}</option>`).join('')}</select>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="App.cambiarRol('${u.id}')">Guardar rol</button>
                    </div>
                </div>`).join('') || '<div class="empty">Sin usuarios</div>';
        } catch (e) { $('#lst-usuarios').innerHTML = `<div class="center muted">⚠️ ${e.message}</div>`; }
    }

    async function cambiarRol(usuarioId) {
        try {
            const rol = $('#rol-' + usuarioId).value;
            await API.asignarRol(usuarioId, rol);
            showToast('Rol actualizado', 'ok');
            renderUsuarios();
        } catch (e) { showToast(e.message, 'err'); }
    }

    function formInvitacion() {
        openModal(`
            <h2>Código de invitación <button class="close" onclick="App.cerrarModal()">✕</button></h2>
            <div class="meta-box">Comparte este código con la persona. Ella crea su cuenta desde "Crear cuenta con código".</div>
            <div class="field"><label>Para (descripción)</label><input id="inv-desc" placeholder="p.ej. Juan Pérez"></div>
            <div class="field"><label>Rol inicial</label>
                <select id="inv-rol">
                    <option value="miembro">Miembro</option>
                    <option value="misionero">Misionero</option>
                    <option value="frecuentador">Frecuentador</option>
                    <option value="responsable">Responsable</option>
                    <option value="ministro">Ministro</option>
                    <option value="presidente">Presidente</option>
                </select>
            </div>
            <div class="field"><label>Sector</label><input id="inv-sector" placeholder="Sector/congregación"></div>
            <div id="inv-resultado"></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.cerrarModal()">Cerrar</button>
                <button class="btn btn-primary" onclick="App.guardarInvitacion()">Generar código</button>
            </div>
        `);
    }

    async function guardarInvitacion() {
        try {
            const d = await API.crearInvitacion({
                descripcion: $('#inv-desc').value, rol: $('#inv-rol').value, sector: $('#inv-sector').value,
            });
            $('#inv-resultado').innerHTML = `
                <div class="card" style="text-align:center;background:var(--primary);color:#fff">
                    <div class="muted" style="color:#e5e7eb;font-size:12px">CÓDIGO</div>
                    <div style="font-size:32px;font-weight:800;letter-spacing:4px">${d.codigo}</div>
                    <div style="font-size:12px;color:#e5e7eb;margin-top:4px">Compártelo con la persona</div>
                </div>`;
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= FAB =================
    function openFab() {
        const m = $('#fab-menu');
        m.classList.toggle('hidden');
        if (can(ROLES_DISC)) {
            m.innerHTML = `
                <button class="fab-item" onclick="App.fabAccion('visita')">🏠 Registrar visita</button>
                <button class="fab-item" onclick="App.fabAccion('estudio')">📚 Registrar estudio</button>
                <button class="fab-item" onclick="App.fabAccion('lectura')">📖 Asignar lectura</button>
            `;
        }
    }

    function fabAccion(tipo) {
        $('#fab-menu').classList.add('hidden');
        showToast('Abre el perfil de un miembro para registrar ' + (tipo === 'visita' ? 'una visita' : tipo === 'estudio' ? 'un estudio' : 'una lectura'), 'warn');
    }

    // ================= LOGIN =================
    function renderLogin() {
        const c = $('#main-content');
        if (!API.configurado) {
            c.innerHTML = `
                <div style="min-height:70vh;display:flex;flex-direction:column;justify-content:center;max-width:360px;margin:0 auto">
                    <div style="text-align:center;margin-bottom:24px">
                        <div style="font-size:48px">⚙️</div>
                        <h2 style="margin:8px 0 4px;color:var(--primary)">Falta la configuración</h2>
                        <div class="muted">Edita <code>config.js</code> con la URL y la clave anon de tu proyecto de Supabase.</div>
                    </div>
                </div>
            `;
            return;
        }
        c.innerHTML = `
            <div style="min-height:70vh;display:flex;flex-direction:column;justify-content:center;max-width:360px;margin:0 auto">
                <div style="text-align:center;margin-bottom:24px">
                    <div style="font-size:48px">👥</div>
                    <h2 style="margin:8px 0 4px;color:var(--primary)">Seguimiento de Miembros</h2>
                    <div class="muted">Iglesia Mundial del Mesías Bolivia</div>
                </div>
                <div class="card">
                    <div class="field"><label>Correo electrónico</label><input id="lg-user" type="email" placeholder="tucorreo@ejemplo.com" autocomplete="username"></div>
                    <div class="field"><label>Contraseña</label><input type="password" id="lg-pass" autocomplete="current-password" onkeydown="if(event.key==='Enter')App.login()"></div>
                    <button class="btn btn-primary" onclick="App.login()">Ingresar</button>
                    <button class="btn btn-outline" style="margin-top:8px" onclick="App.toggleRegistro()">Crear cuenta con código</button>
                </div>
                <div class="card hidden" id="card-registro">
                    <h3>Crear cuenta</h3>
                    <div class="field"><label>Nombre completo *</label><input id="rg-nombre" placeholder="Nombre y apellidos"></div>
                    <div class="field"><label>Correo electrónico *</label><input id="rg-email" type="email" placeholder="tucorreo@ejemplo.com"></div>
                    <div class="field"><label>Contraseña *</label><input id="rg-pass" type="password" placeholder="Mínimo 6 caracteres"></div>
                    <div class="field"><label>Código de invitación *</label><input id="rg-codigo" placeholder="IGLESIA"></div>
                    <button class="btn btn-primary" onclick="App.registrar()">Crear cuenta</button>
                </div>
            </div>
        `;
    }

    function toggleRegistro() {
        const c = $('#card-registro');
        if (c) c.classList.toggle('hidden');
    }

    async function registrar() {
        try {
            await API.registrar({
                nombre: $('#rg-nombre').value.trim(),
                email: $('#rg-email').value.trim(),
                password: $('#rg-pass').value,
                codigo: $('#rg-codigo').value.trim(),
            });
            showToast('¡Cuenta creada! Bienvenido.', 'ok');
            enterApp();
        } catch (e) { showToast(e.message, 'err'); }
    }

    async function login() {
        try {
            await API.login($('#lg-user').value.trim(), $('#lg-pass').value);
            enterApp();
        } catch (e) { showToast(e.message, 'err'); }
    }

    // ================= INIT =================
    function fillHeader() {
        const u = API.usuario;
        if (!u) return;
        $('#hdr-rol').textContent = u.rol;
        $('#hdr-rol').style.display = 'inline-block';
        $('#menu-nombre').textContent = u.nombre;
        $('#menu-user').textContent = u.username;
        $('#menu-avatar').textContent = initials(u.nombre);
    }

    async function enterApp() {
        fillHeader();
        setTitle('Inicio');
        $('#fab').style.display = 'flex';
        go('inicio');
    }

    function logout() {
        API.logout().finally(() => { window.location.reload(); });
    }

    // ---- Init ----
    async function init() {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
        await API.ready();
        if (!API.token || !API.usuario) {
            $('#fab').style.display = 'none';
            renderLogin();
        } else {
            enterApp();
        }
    }

    // ================= PUBLIC API =================
    return {
        init, go, login, logout, toggleMenu, cerrarModal,
        refreshMiembros, verMiembro, tabPerfil,
        entrevistaModal, guardarEntrevista, pilarVal,
        visitaModal, guardarVisita, estudioModal, guardarEstudio,
        lecturaModal, guardarLectura, planModal, guardarPlan,
        verRegistros, registrarProgreso,
        registrar, toggleRegistro,
        formInvitacion, guardarInvitacion, cambiarRol,
        openFab, fabAccion,
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
