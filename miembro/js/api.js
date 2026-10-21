// ============================================================================
// Seguimiento de Miembros - capa de datos sobre Supabase
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

    let token = localStorage.getItem('mb_token') || null;
    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem('mb_usuario') || 'null'); } catch (e) { usuario = null; }

    // Normaliza valores vacios -> null (Postgres no acepta '' en columnas date)
    const v = (x) => (x === undefined || x === null || x === '' ? null : x);

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
            sector: data.sector,
            email: data.email,
        };
        localStorage.setItem('mb_usuario', JSON.stringify(usuario));
        return usuario;
    }

    function logoutLocal() {
        token = null; usuario = null;
        localStorage.removeItem('mb_token');
        localStorage.removeItem('mb_usuario');
    }

    // Restaura la sesion de Supabase al abrir la app
    const ready = (async () => {
        if (!sb) return null;
        try {
            const { data } = await sb.auth.getSession();
            const sesion = data && data.session;
            if (sesion) {
                token = sesion.access_token;
                localStorage.setItem('mb_token', token);
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
            localStorage.setItem('mb_token', token);
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
            localStorage.setItem('mb_token', token);
            await rpc('usar_invitacion', { p_codigo: (codigo || '').trim() });
            await cargarUsuario();
            return { token, usuario };
        },

        async logout() {
            try { if (sb) await sb.auth.signOut(); } catch (e) {}
            logoutLocal();
        },

        // ---------- Usuarios e invitaciones ----------
        async listarUsuarios() {
            const usuarios = await rpc('listar_usuarios');
            return { usuarios: usuarios || [] };
        },

        async crearInvitacion({ descripcion, rol, sector }) {
            const codigo = await rpc('crear_invitacion', {
                p_descripcion: v(descripcion), p_rol: v(rol) || 'miembro', p_sector: v(sector),
            });
            return { codigo, mensaje: 'Codigo de invitacion creado: ' + codigo };
        },

        async asignarRol(usuario_id, rol, sector) {
            await rpc('asignar_rol', { p_usuario: usuario_id, p_rol: rol, p_sector: v(sector) });
            return { mensaje: 'Rol actualizado' };
        },

        // ---------- Miembros ----------
        async members() { return this.membersFiltro('', ''); },

        async membersFiltro(filtro, estado) {
            const miembros = await rpc('mb_listar_miembros', { p_filtro: v(filtro), p_estado: v(estado) });
            return { miembros: miembros || [] };
        },

        async memberPerfil(id) {
            return await rpc('mb_perfil_miembro', { p_usuario: id });
        },

        async guardarPerfil(d) {
            return await rpc('mb_guardar_perfil', {
                p_usuario: d.usuario_id,
                p_nivel_oracion: d.nivel_inicial_oracion || 1,
                p_nivel_cancion: d.nivel_inicial_cancion || 1,
                p_nivel_alimentacion: d.nivel_inicial_alimentacion || 1,
                p_estado: d.estado || 'nuevo',
                p_notas: v(d.notas_entrevista_inicial),
            });
        },

        // ---------- Seguimiento ----------
        async registrarEntrevista(d) {
            return await rpc('mb_registrar_entrevista', {
                p_usuario_id: d.usuario_id,
                p_fecha: v(d.fecha),
                p_tipo: d.tipo || 'seguimiento',
                p_nivel_oracion: d.nivel_oracion || 1,
                p_nivel_cancion: d.nivel_cancion || 1,
                p_nivel_alimentacion: d.nivel_alimentacion || 1,
                p_observaciones: v(d.observaciones),
            });
        },

        async registrarVisita(d) {
            return await rpc('mb_registrar_visita', {
                p_usuario_id: d.usuario_id,
                p_fecha: v(d.fecha),
                p_tipo: d.tipo || 'domicilio',
                p_motivo: v(d.motivo),
                p_observaciones: v(d.observaciones),
            });
        },

        async registrarEstudio(d) {
            return await rpc('mb_registrar_estudio', {
                p_usuario_id: d.usuario_id,
                p_tema: d.tema,
                p_fecha: v(d.fecha),
                p_duracion_min: d.duracion_min || 60,
                p_notas: v(d.notas),
            });
        },

        async asignarLectura(d) {
            return await rpc('mb_asignar_lectura', {
                p_usuario_id: d.usuario_id,
                p_titulo: d.titulo,
                p_autor: v(d.autor),
                p_fecha_asignada: v(d.fecha_asignada),
                p_notas: v(d.notas),
            });
        },

        async actualizarLectura(id, estado, notas) {
            return await rpc('mb_actualizar_lectura', {
                p_id: id, p_estado: estado, p_notas: v(notas),
            });
        },

        async crearPlan(d) {
            return await rpc('mb_crear_plan', {
                p_usuario_id: d.usuario_id,
                p_fecha_inicio: v(d.fecha_inicio),
                p_fecha_fin: v(d.fecha_fin),
                p_notas: v(d.notas),
                p_actividades: Array.isArray(d.actividades) && d.actividades.length ? d.actividades : null,
            });
        },

        async registrarProgreso(d) {
            return await rpc('mb_registrar_progreso', {
                p_actividad_id: d.actividad_id,
                p_cumplido: d.cumplido === undefined ? true : !!d.cumplido,
                p_fecha: v(d.fecha),
                p_notas: v(d.notas),
            });
        },

        async miActividad() {
            const actividades = await rpc('mb_mi_actividad');
            return { actividades: actividades || [] };
        },

        async dashboard() {
            return await rpc('mb_dashboard');
        },

        async reporte() {
            return await rpc('mb_reporte_consolidado');
        },

        async reporteMiembro(id) {
            return await rpc('mb_reporte_miembro', { p_usuario: id });
        },
    };
})();
