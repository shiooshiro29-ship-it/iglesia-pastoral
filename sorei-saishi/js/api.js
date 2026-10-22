// ============================================================================
// SOREI-Saishi - capa de datos sobre Supabase
// Mantiene el mismo contrato que la API PHP para no tocar la interfaz.
// ============================================================================
const API = (() => {
    const CFG = window.APP_CONFIG || {};
    const configurado = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && typeof supabase !== 'undefined');

    const sb = configurado
        ? supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        })
        : null;

    let token = localStorage.getItem('ss_token') || null;
    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem('ss_usuario') || 'null'); } catch (e) { usuario = null; }

    const v = (x) => (x === undefined || x === null || x === '' ? null : x);
    const n = (x) => (x === undefined || x === null || x === '' ? null : Number(x));

    function errorConfig() {
        return new Error('La app aun no esta conectada a Supabase. Edita config.js con la URL del proyecto y la clave anon.');
    }

    async function rpc(nombre, params) {
        if (!sb) throw errorConfig();
        const { data, error } = await sb.rpc(nombre, params || {});
        if (error) throw new Error(error.message || 'Error de la base de datos');
        return data;
    }

    async function cargarUsuario() {
        if (!sb) return null;
        const { data: { user }, error: errUser } = await sb.auth.getUser();
        if (errUser || !user) return null;
        const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
        if (error) throw new Error(error.message);
        usuario = {
            id: data.id,
            username: data.username || data.email,
            nombre: data.nombre,
            rol: data.rol,
        };
        localStorage.setItem('ss_usuario', JSON.stringify(usuario));
        return usuario;
    }

    function logoutLocal() {
        token = null; usuario = null;
        localStorage.removeItem('ss_token');
        localStorage.removeItem('ss_usuario');
    }

    const ready = (async () => {
        if (!sb) return null;
        try {
            const { data } = await sb.auth.getSession();
            const sesion = data && data.session;
            if (sesion) {
                token = sesion.access_token;
                localStorage.setItem('ss_token', token);
                await cargarUsuario();
            } else {
                logoutLocal();
            }
        } catch (e) {
            logoutLocal();
        }
        return usuario;
    })();

    return {
        get token() { return token; },
        get usuario() { return usuario; },
        get configurado() { return configurado; },
        ready() { return ready; },

        // ---------- Sesion ----------
        async login(email, password) {
            if (!sb) throw errorConfig();
            const correo = (email || '').trim().toLowerCase();
            if (!correo || !password) throw new Error('Correo y contrasena son obligatorios');
            const { data, error } = await sb.auth.signInWithPassword({ email: correo, password });
            if (error) {
                throw new Error(error.message === 'Invalid login credentials'
                    ? 'Correo o contrasena incorrectos'
                    : error.message);
            }
            token = data.session.access_token;
            localStorage.setItem('ss_token', token);
            await cargarUsuario();
            return { token, usuario };
        },

        async registrar({ email, password, nombre, codigo }) {
            if (!sb) throw errorConfig();
            const correo = (email || '').trim().toLowerCase();
            if (!correo || !password) throw new Error('Correo y contrasena son obligatorios');
            if (!nombre) throw new Error('El nombre es obligatorio');
            if ((password || '').length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres');

            const { data: valido, error: errVal } = await sb.rpc('validar_invitacion', { p_codigo: (codigo || '').trim() });
            if (errVal) throw new Error(errVal.message);
            if (!valido) throw new Error('El codigo de invitacion no es valido');

            const { data, error } = await sb.auth.signUp({
                email: correo,
                password,
                options: { data: { nombre, username: correo.split('@')[0] } },
            });
            if (error) throw new Error(error.message);
            if (!data.session) {
                throw new Error('Cuenta creada. Revisa tu correo para confirmar la cuenta antes de ingresar.');
            }
            token = data.session.access_token;
            localStorage.setItem('ss_token', token);
            await rpc('usar_invitacion', { p_codigo: (codigo || '').trim() });
            await cargarUsuario();
            return { token, usuario };
        },

        async logout() {
            try { if (sb) await sb.auth.signOut(); } catch (e) {}
            logoutLocal();
        },

        // ---------- Dashboard ----------
        async dashboard() {
            return await rpc('ss_dashboard');
        },

        async telegramEstado() {
            return await rpc('ss_telegram_estado');
        },

        // ---------- Invitaciones y usuarios ----------
        async listarUsuarios() {
            const usuarios = await rpc('listar_usuarios');
            return { usuarios: usuarios || [] };
        },

        async crearInvitacion({ descripcion, rol }) {
            const codigo = await rpc('crear_invitacion', {
                p_descripcion: v(descripcion), p_rol: v(rol) || 'miembro', p_sector: null,
            });
            return { codigo, mensaje: 'Codigo de invitacion creado: ' + codigo };
        },

        async asignarRol(usuario_id, rol) {
            await rpc('asignar_rol', { p_usuario: usuario_id, p_rol: rol, p_sector: null });
            return { mensaje: 'Rol actualizado' };
        },

        // ---------- Antepasados ----------
        async antepasados() {
            const lista = await rpc('ss_antepasados');
            return { antepasados: lista || [] };
        },

        async crearAntepasado(d) {
            const id = await rpc('ss_crear_antepasado', {
                p_nombres: d.nombres, p_parentesco: v(d.parentesco),
                p_fecha_fallecimiento: v(d.fecha_fallecimiento), p_aniversario: v(d.aniversario),
                p_notas: v(d.notas),
            });
            return { id, mensaje: 'Antepasado registrado' };
        },

        // ---------- Solicitudes ----------
        async misSolicitudes(estado, tipo) {
            const lista = await rpc('ss_solicitudes', { p_estado: v(estado), p_tipo: v(tipo), p_solo_mias: true });
            return { solicitudes: lista || [] };
        },

        async todasSolicitudes(estado, tipo) {
            const lista = await rpc('ss_solicitudes', { p_estado: v(estado), p_tipo: v(tipo), p_solo_mias: false });
            return { solicitudes: lista || [] };
        },

        async detalleSolicitud(id) {
            return await rpc('ss_detalle_solicitud', { p_id: Number(id) });
        },

        async solicitar(d) {
            return await rpc('ss_solicitar', {
                p_tipo: d.tipo, p_antepasado_id: n(d.antepasado_id), p_fecha_evento: v(d.fecha_evento),
                p_observaciones: v(d.observaciones),
            });
        },

        async editarSolicitud(id, d) {
            return await rpc('ss_editar_solicitud', {
                p_id: Number(id), p_fecha_evento: v(d.fecha_evento), p_antepasado_id: n(d.antepasado_id),
                p_observaciones: v(d.observaciones),
            });
        },

        async cancelarSolicitud(id) {
            return await rpc('ss_cancelar_solicitud', { p_id: Number(id) });
        },

        // ---------- Validacion ----------
        async bandeja(estado) {
            const lista = await rpc('ss_bandeja', { p_estados: v(estado) });
            return { solicitudes: lista || [] };
        },

        async accionValidacion(accion, id, observaciones) {
            return await rpc('ss_accion_validacion', {
                p_accion: accion, p_id: Number(id), p_observaciones: v(observaciones),
            });
        },

        async firmasPendientes() {
            const lista = await rpc('ss_firmas_pendientes');
            return { firmas: lista || [] };
        },

        async detalleFirmas(id) {
            return await rpc('ss_detalle_firmas', { p_id: Number(id) });
        },

        async firmarEidai(solicitudId, aceptar, observaciones) {
            return await rpc('ss_firmar_eidai', {
                p_solicitud_id: Number(solicitudId), p_aceptar: !!aceptar, p_observaciones: v(observaciones),
            });
        },

        // ---------- Fallecimientos y transferencias ----------
        async listarFallecimientos() {
            const lista = await rpc('ss_fallecimientos');
            return { fallecimientos: lista || [] };
        },

        async registrarFallecimiento(d) {
    return await rpc('ss_registrar_fallecimiento', {
      p_nombres: d.nombres || d.fallecido_nombres || '',
      p_apellidos: v(d.apellidos),
      p_ci: v(d.ci),
      p_sexo: v(d.sexo),
      p_edad: d.edad_fallecimiento !== undefined && d.edad_fallecimiento !== '' ? Number(d.edad_fallecimiento) : (d.edad !== undefined && d.edad !== '' ? Number(d.edad) : null),
      p_fecha_fallecimiento: v(d.fecha_fallecimiento),
      p_es_miembro: d.es_miembro === true || d.es_miembro === 'true',
      p_solicitante_id: v(d.solicitante_id),
      p_tipo_relacion: v(d.tipo_relacion),
      p_certificado: v(d.certificado)
    });
  }

  async listarFallecidos() {
    try { return { fallecimientos: await rpc('ss_lista_fallecidos_completa', {}) }; } catch(e) { return await this.listarFallecimientos(); }
  }

  async perfiles() {
    const lista = await rpc('ss_perfiles_miembros', {});
    return { profiles: lista || [] };
  }

  async avisosCultosAntepasados(dias=7) {
    return await rpc('ss_avisos_cultos_antepasados', { p_dias: dias });
  }

  async marcarAvisoAntepasado(id, notas=null) {
    return await rpc('ss_marcar_aviso_antepasado', { p_id: id, p_notas: notas });
  }

  async programarCultoAntepasado(avisoId, fecha=null, hora=null, lugar=null) {
    return await rpc('ss_programar_culto_antepasado', { p_aviso_id: avisoId, p_fecha: fecha, p_hora: hora, p_lugar: lugar });
  }

  async historialCultosAntepasados(fallecimientoId) {
    return await rpc('ss_historial_cultos_antepasados', { p_fallecimiento_id: fallecimientoId });
  }

  async regenerarAnualesAntepasados(anio=null) {
    return await rpc('ss_regenerar_anuales_antepasados', { p_anio: anio });
  },

  async enviarAvisosWhatsApp(dias=3) {
    if (!sb) throw errorConfig();
    const { data, error } = await sb.functions.invoke('notificar-whatsapp', { body: { dias } });
    if (error) throw new Error('No se pudo enviar por WhatsApp: ' + (error.message || 'error'));
    return data;
  },

        async transferencias() {
            const lista = await rpc('ss_transferencias');
            return { transferencias: lista || [] };
        },

        async crearTransferencia(registroId, tipoOrigen) {
            return await rpc('ss_crear_transferencia', {
                p_registro_id: Number(registroId), p_tipo_origen: tipoOrigen,
            });
        },

        // ---------- Orientaciones ----------
        async orientaciones() {
            const lista = await rpc('ss_orientaciones');
            return { orientaciones: lista || [] };
        },

        async orientacionesNecesarias() {
            return await rpc('ss_orientaciones_necesarias');
        },

        async registrarOrientacion(solicitanteId, contenido) {
            return await rpc('ss_registrar_orientacion', {
                p_solicitante_id: Number(solicitanteId), p_contenido: contenido,
            });
        },

        // ---------- Calendario ----------
        async proximosCultos() {
            return await rpc('ss_cultos');
        },

        async programarCulto(d) {
            return await rpc('ss_programar_culto', {
                p_solicitud_id: n(d.solicitud_id), p_fecha: v(d.fecha), p_hora: v(d.hora), p_lugar: v(d.lugar),
            });
        },

        async eliminarCulto(id) {
            return await rpc('ss_eliminar_culto', { p_id: Number(id) });
        },

        // ---------- Cronogramas ----------
        async cronogramas() {
            return await rpc('ss_cronogramas');
        },

        async crearCronograma(d) {
            return await rpc('ss_crear_cronograma', {
                p_tipo: d.tipo, p_anio: n(d.anio), p_fecha_inicio: v(d.fecha_inicio),
                p_fecha_fin: v(d.fecha_fin), p_dias_anticipacion: n(d.dias_anticipacion) || 15,
            });
        },

        async editarCronograma(id, d) {
            return await rpc('ss_editar_cronograma', {
                p_id: Number(id), p_tipo: v(d.tipo), p_fecha_inicio: v(d.fecha_inicio),
                p_fecha_fin: v(d.fecha_fin), p_dias_anticipacion: n(d.dias_anticipacion) || 15,
            });
        },

        // ---------- Reportes ----------
        async reporteConsolidado() {
            return await rpc('ss_reporte_consolidado');
        },

        async reporteListado(tipo, estado) {
            return await rpc('ss_reporte_listado', { p_tipo: v(tipo), p_estado: v(estado) });
        },
    };
})();
