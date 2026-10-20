import { handle, json, readJson, text, getId, HttpError } from "../lib/http.js";
import { query } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";
import { escapeHtml, mailEnabled, sendMail } from "../lib/mail.js";

// Público: envía un mensaje desde el formulario de contacto.
export const POST = handle(async (request) => {
  const body = await readJson(request);
  // Campo trampa para bots: los humanos no lo ven ni lo llenan.
  if (body.website) return json({ ok: true }, 201);

  const name = text(body.name, 200);
  const email = text(body.email, 200);
  const message = text(body.message, 5000);
  if (!name || !email || !message) throw new HttpError(400, "Completa nombre, email y mensaje");

  const phone = text(body.phone, 50);
  const subject = text(body.subject, 200);
  await query(
    "INSERT INTO messages (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5)",
    [name, email, phone, subject, message]
  );

  // El mensaje ya quedó guardado: si el correo falla, el visitante igual ve "enviado".
  try {
    await notifyCompany({ name, email, phone, subject, message, origin: new URL(request.url).origin });
  } catch (err) {
    console.error("No se pudo enviar el aviso por correo:", err.message);
  }
  return json({ ok: true }, 201);
});

// Aviso por correo a la empresa. Destino: NOTIFY_EMAIL o el email de "Datos de la empresa".
async function notifyCompany({ name, email, phone, subject, message, origin }) {
  if (!mailEnabled()) return;
  let to = process.env.NOTIFY_EMAIL;
  if (!to) {
    const [row] = await query("SELECT value FROM settings WHERE key = 'email'");
    to = row?.value;
  }
  if (!to) return;

  const rows = [
    ["Nombre", name],
    ["Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`],
    ["Teléfono", phone ? `<a href="tel:${escapeHtml(phone.replace(/\s/g, ""))}">${escapeHtml(phone)}</a>` : "—"],
    ["Asunto", subject || "—"],
  ];
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#333">
      <h2 style="color:#1a3a5c;margin:0 0 12px">Nuevo mensaje desde el sitio web</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:6px 12px 6px 0;color:#5f6b78;width:90px">${label}</td><td style="padding:6px 0">${
                label === "Email" || label === "Teléfono" ? value : escapeHtml(value)
              }</td></tr>`
          )
          .join("")}
      </table>
      <div style="margin:16px 0;padding:14px;background:#f3f5f8;border-left:4px solid #f0c040;border-radius:6px;white-space:pre-line">${escapeHtml(message)}</div>
      <p style="font-size:13px;color:#5f6b78">Responde este correo para escribirle directamente a ${escapeHtml(name)}, o revisa todos los mensajes en
      <a href="${origin}/panel/mensajes" style="color:#1a3a5c">el panel</a>.</p>
    </div>`;

  await sendMail({
    to,
    replyTo: email,
    subject: `Nuevo mensaje de ${name}${subject ? ` · ${subject}` : ""}`,
    html,
    text: `Nuevo mensaje desde el sitio web\n\nNombre: ${name}\nEmail: ${email}\nTeléfono: ${phone || "—"}\nAsunto: ${subject || "—"}\n\n${message}\n\nPanel: ${origin}/panel/mensajes`,
  });
}

export const GET = handle(async (request) => {
  await requireAdmin(request);

  // ?summary=1: resumen liviano para los avisos del panel.
  if (new URL(request.url).searchParams.has("summary")) {
    const [counts] = await query(
      "SELECT count(*) FILTER (WHERE NOT read)::int AS unread, COALESCE(max(id), 0)::int AS last_id FROM messages"
    );
    const [latest] = await query(
      "SELECT id, name, subject FROM messages WHERE NOT read ORDER BY id DESC LIMIT 1"
    );
    return json({ ...counts, latest: latest || null });
  }

  return json(await query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 500"));
});

// Marca como leído / no leído.
export const PUT = handle(async (request) => {
  await requireAdmin(request);
  const body = await readJson(request);
  await query("UPDATE messages SET read = $1 WHERE id = $2", [Boolean(body.read), getId(request)]);
  return json({ ok: true });
});

export const DELETE = handle(async (request) => {
  await requireAdmin(request);
  await query("DELETE FROM messages WHERE id = $1", [getId(request)]);
  return json({ ok: true });
});
