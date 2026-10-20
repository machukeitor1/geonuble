// Envío de correos con Resend (https://resend.com) usando su API HTTP.
// Sin RESEND_API_KEY no se envía nada (útil en desarrollo).
//
// Sin dominio verificado en Resend, el remitente debe ser onboarding@resend.dev
// y solo se puede enviar al correo con el que se creó la cuenta de Resend.
const FROM = process.env.MAIL_FROM || "Geoñuble Propiedades <onboarding@resend.dev>";

export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY);

// `to` acepta uno o varios correos (arreglo o texto separado por comas).
export async function sendMail({ to, subject, html, text, replyTo }) {
  const recipients = (Array.isArray(to) ? to : String(to || "").split(",")).map((e) => e.trim()).filter(Boolean);
  if (!mailEnabled() || recipients.length === 0) return { skipped: true };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: recipients, subject, html, text, reply_to: replyTo || undefined }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
