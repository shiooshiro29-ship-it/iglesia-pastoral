# Iglesia Mundial del Mesías · Bolivia

Aplicaciones internas de la iglesia, publicadas como sitios estáticos (PWA) en
**GitHub Pages** con base de datos en **Supabase** (PostgreSQL + Auth + RLS).

## Aplicaciones

| Ruta | Aplicación | Para qué sirve |
|------|------------|----------------|
| `/` | Portal | Elegir la aplicación |
| `/miembro/` | Seguimiento de Miembros | Entrevistas, visitas, estudios, lecturas y planes de las tres columnas de salvación |
| `/sorei-saishi/` | Sorei Saishi | Antepasados, solicitudes, firmas Eidai, fallecimientos, transferencias, orientaciones y calendario |

Ambas comparten una sola tabla de identidad (`public.profiles`) y los mismos
roles: `administrador`, `presidente`, `responsable`, `ministro`, `misionero`,
`miembro`, `frecuentador`.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> y crea un proyecto (plan gratuito).
2. En **Authentication → Sign In / Providers → Email**, **desactiva
   “Confirm email”**. Sin esto el registro no devuelve sesión.
3. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public` (clave pública)

> La clave `anon` puede estar en el repositorio: es pública por diseño. La
> seguridad la aplican las políticas RLS. **Nunca** publiques la clave
> `service_role`.

### 2. Crear las tablas

En **SQL Editor**, ejecuta en este orden:

1. `supabase/01_comun.sql` — identidad, roles, invitaciones, RLS de perfiles.
2. `supabase/02_miembro.sql` — tablas y funciones de Seguimiento de Miembros.
3. `supabase/03_sorei.sql` — tablas y funciones de Sorei Saishi.
4. `supabase/04_seed.sql` — código de invitación `IGLESIA`, cronogramas base y feriados.
5. `supabase/05_pg_cron.sql` — *(opcional)* automatización diaria de los cultos de
   antepasados con `pg_cron` (regenerar el aniversario anual y recalcular fechas
   si cambian los feriados). Si no se ejecuta, se puede renovar manualmente desde
   el botón **♻️ Renovar aniversarios anuales** en la app.

### 3. Configurar la URL y la clave

Edita `config.js` en la raíz del repositorio:

```js
window.APP_CONFIG = {
    supabaseUrl: 'https://TU-PROYECTO.supabase.co',
    supabaseAnonKey: 'TU-CLAVE-ANON',
};
```

### 4. Crear el primer administrador

1. Abre la app y usa **“Crear cuenta con código”** con el código **`IGLESIA`**.
2. Vuelve al SQL Editor y promueve tu cuenta:

```sql
update public.profiles
set rol = 'administrador'
where email = 'tucorreo@ejemplo.com';
```

3. Cierra sesión y vuelve a entrar. Ya puedes crear códigos de invitación desde
   **Usuarios / Configuración** y repartirlos entre los demás.

## Publicar en GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta (rama `main`).
2. **Settings → Pages**: origen *Deploy from a branch*, rama `main`, carpeta
   `/ (root)`.
3. La URL será `https://USUARIO.github.io/REPO/`.
4. Cada dispositivo puede “Agregar a la pantalla de inicio”: son PWAs.

El archivo `.nojekyll` ya está incluido para que GitHub Pages no procese las
carpetas como Jekyll.

## Probar en local

Cualquier servidor estático sirve; por ejemplo, con PHP (XAMPP):

```powershell
C:\xampp\php\php.exe -S localhost:8000
```

y abrir <http://localhost:8000>.

## Notas

- El **bot de Telegram** de Sorei Saishi requiere un proceso persistente. En la
  versión Supabase la pantalla de estado funciona, pero el envío real de
  mensajes necesita una *Edge Function* o un pequeño servidor aparte.
- Las dos apps cachean sus archivos con un *service worker*. Si actualizas el
  código, sube la versión `CACHE` en `miembro/sw.js` y `sorei-saishi/sw.js`.
- La carpeta `supabase/` contiene el esquema de la base de datos. Guárdala en
  el repositorio como respaldo y documentación.
