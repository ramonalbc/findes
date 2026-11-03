// Supabase Edge Function "calendar": publica en formato iCalendar (.ics) los planes que
// cada uno ha marcado para sincronizar. El iPhone se suscribe a
//   webcal://sfizuisbomgkvvkvylmq.supabase.co/functions/v1/calendar?t=<enlace privado>
// No necesita secretos: usa la clave pública y la función calendar_feed de la base de datos,
// que solo devuelve datos a quien tiene el enlace privado.

const SUPABASE_URL = "https://sfizuisbomgkvvkvylmq.supabase.co";
const PUBLIC_KEY = "sb_publishable_froAG8ZB_4InA7ItrhMYQw_t4buUvC8";

type Plan = {
  id: string; title: string; category: string; who: string; date_from: string; date_to: string;
  start_time: string | null; end_time: string | null; location: string | null; status: string;
  notes: string | null; updated_at: string;
};

const WHO: Record<string, string> = { ramon: "Ramón", irene: "Irene", ambos: "Los dos" };

const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
  "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
  "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const d8 = (iso: string) => iso.replaceAll("-", "");
const t6 = (t: string) => t.slice(0, 5).replace(":", "") + "00";

function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function plusHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Las líneas de un .ics no deben pasar de 75 octetos
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(plans: Plan[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Findes//Ramon e Irene//ES", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", "X-WR-CALNAME:Findes", "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];
  for (const p of plans) {
    const stamp = p.updated_at ? new Date(p.updated_at).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z" : now;
    lines.push("BEGIN:VEVENT", `UID:${p.id}@findes`, `DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`);
    if (p.start_time) {
      let end = p.end_time ?? plusHour(p.start_time);
      if (p.date_from === p.date_to && end <= p.start_time.slice(0, 5)) end = plusHour(p.start_time);
      lines.push(`DTSTART;TZID=Europe/Madrid:${d8(p.date_from)}T${t6(p.start_time)}`);
      lines.push(`DTEND;TZID=Europe/Madrid:${d8(p.date_to)}T${t6(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d8(p.date_from)}`, `DTEND;VALUE=DATE:${d8(nextDay(p.date_to))}`);
    }
    const title = p.title + (p.status === "pendiente" ? " (pendiente)" : "");
    lines.push(`SUMMARY:${esc(title)}`);
    if (p.location) lines.push(`LOCATION:${esc(p.location)}`);
    const desc = [`Quién: ${WHO[p.who] ?? p.who}`, p.notes ?? ""].filter(Boolean).join("\n");
    lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push(`STATUS:${p.status === "pendiente" ? "TENTATIVE" : "CONFIRMED"}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (token.length < 32) return new Response("Not found", { status: 404 });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: "POST",
    headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) return new Response("Error " + r.status, { status: 502 });
  const plans: Plan[] = await r.json();
  return new Response(buildIcs(plans), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="findes.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
