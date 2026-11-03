// Supabase Edge Function "notify": recibe el aviso desde la base de datos y lo envía
// como notificación push a los iPhone suscritos.
// Secretos necesarios (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, FINDES_SECRET
import webpush from "npm:web-push@3.6.7";

const PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SECRET = Deno.env.get("FINDES_SECRET") ?? "";

webpush.setVapidDetails("mailto:ramonalbc@gmail.com", PUBLIC, PRIVATE);

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-findes-secret") !== SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const { title, body, url, subs } = await req.json();
  const payload = JSON.stringify({ title, body, url });
  const results = await Promise.allSettled(
    (subs ?? []).map((s: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: "normal" },
      )
    ),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return new Response(JSON.stringify({ sent: results.length - failed, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
