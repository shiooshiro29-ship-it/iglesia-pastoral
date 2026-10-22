// ============================================================================
// Supabase Edge Function - Notificar avisos de cultos de antepasados
// por WhatsApp (WhatsApp Cloud API de Meta)
// ============================================================================
// Ruta sugerida: supabase/functions/notificar-whatsapp/index.ts
//
// DESPLIEGUE (una sola vez, con la CLI de Supabase):
//   supabase functions deploy notificar-whatsapp --no-verify-jwt
//
// VARIABLES DE ENTORNO (supabase secrets set ...):
//   WHATSAPP_TOKEN        Token permanente de la app de Meta (System User)
//   WHATSAPP_PHONE_ID     ID del numero de telefono (Phone Number ID)
//   WHATSAPP_DESTINOS     Lista separada por comas, ej: 59171234567,59170000000
//   CRON_SECRET           Cadena secreta para proteger la ejecucion por cron
//
// INVOCACION:
//   - Manual (boton en la app): POST con cabecera Authorization: Bearer <jwt>
//   - Cron (pg_cron + pg_net): POST con cabecera x-cron-secret: <CRON_SECRET>
//
// La funcion:
//   1. Consulta los avisos de antepasados (proximos N dias) via RPC.
//   2. Arma un mensaje de texto y lo envia por la API de WhatsApp.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const DESTINOS = (Deno.env.get("WHATSAPP_DESTINOS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function fmt(fecha: string): string {
  if (!fecha) return "-";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

Deno.serve(async (req) => {
  try {
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const esCron = CRON_SECRET !== "" && cronHeader === CRON_SECRET;

    let dias = 3;
    try {
      const body = await req.json();
      if (body?.dias != null) dias = Number(body.dias);
    } catch (_) { /* sin body */ }

    if (!esCron) {
      // Fallback: validar JWT de un gestor
      const auth = req.headers.get("Authorization") ?? "";
      const jwt = auth.replace("Bearer ", "");
      if (!jwt) return new Response("No autorizado", { status: 401 });
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: userData, error } = await sb.auth.getUser(jwt);
      if (error || !userData?.user) return new Response("No autorizado", { status: 401 });
      const rol = (userData.user.app_metadata as Record<string, unknown>)?.rol;
      const { data: prof } = await sb.from("profiles").select("rol").eq("id", userData.user.id).single();
      const rolReal = (prof as { rol?: string } | null)?.rol ?? rol;
      if (!["responsable", "presidente", "administrador"].includes(String(rolReal))) {
        return new Response("Permiso denegado", { status: 403 });
      }
    }

    if (!WA_TOKEN || !WA_PHONE_ID || DESTINOS.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, mensaje: "WhatsApp no configurado (faltan variables de entorno)" }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: avisos, error: rpcErr } = await sb.rpc("ss_avisos_cultos_antepasados", { p_dias: dias });
    if (rpcErr) throw rpcErr;

    const lista = (avisos as unknown[]) ?? [];
    if (lista.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, mensaje: "Sin avisos pendientes" }), {
        headers: { "content-type": "application/json" },
      });
    }

    const lineas = lista.map((a: Record<string, unknown>) => {
      const tipo = a.tipo === "decenal" ? `Decenal +${a.dias_desde_fallecimiento} dias` : "Anual";
      const ajuste = a.ajustado ? (a.es_domingo ? " [ajustado: cae domingo]" : " [ajustado: feriado]") : "";
      return `* ${a.fallecido_nombres} ${a.apellidos ?? ""} - ${tipo}\n   Culto: ${fmt(String(a.fecha_culto))}${ajuste}\n   Avisar: ${fmt(String(a.fecha_aviso))}`;
    }).join("\n\n");

    const texto =
      `🕊️ *Avisos de Cultos de Antepasados*\nPróximos ${dias} días:\n\n${lineas}\n\n(Se avisa un día antes. Si cae en domingo o feriado, el culto pasa al sábado. Generado por Sorei Saishi.)`;

    const resultados: unknown[] = [];
    for (const destino of DESTINOS) {
      const resp = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destino,
          type: "text",
          text: { body: texto },
        }),
      });
      const data = await resp.json().catch(() => ({}));
      resultados.push({ destino, status: resp.status, ok: resp.ok, data });
    }

    return new Response(JSON.stringify({ ok: true, enviados: DESTINOS.length, avisos: lista.length, resultados }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
