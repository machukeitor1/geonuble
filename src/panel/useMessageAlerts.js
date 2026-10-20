import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const INTERVAL = 45_000; // revisa cada 45 segundos

export const desktopAlertsSupported = () => typeof Notification !== "undefined";

// Revisa periódicamente si llegaron mensajes del formulario de contacto.
// Devuelve el número sin leer, el aviso del último mensaje nuevo y una función para refrescar.
export function useMessageAlerts(enabled) {
  const [unread, setUnread] = useState(0);
  const [alert, setAlert] = useState(null);
  const lastId = useRef(null);

  const check = useCallback(async () => {
    try {
      const summary = await api("contact?summary=1");
      setUnread(summary.unread);
      // La primera revisión solo fija el punto de partida (sin aviso).
      if (lastId.current !== null && summary.last_id > lastId.current && summary.latest) {
        const { name, subject } = summary.latest;
        setAlert({ id: summary.last_id, name, subject });
        if (desktopAlertsSupported() && Notification.permission === "granted" && document.hidden) {
          const n = new Notification("Nuevo mensaje en Geoñuble", {
            body: `${name}${subject ? ` · ${subject}` : ""}`,
            icon: "/logo.png",
            tag: "geonuble-mensajes",
          });
          n.onclick = () => {
            window.focus();
            window.location.assign("/panel/mensajes");
          };
        }
      }
      lastId.current = summary.last_id;
    } catch {
      // Sin conexión o sesión vencida: se reintenta en la próxima vuelta.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(check, 0);
    const timer = setInterval(() => !document.hidden && check(), INTERVAL);
    const onVisible = () => !document.hidden && check();
    document.addEventListener("visibilitychange", onVisible);
    // Las notificaciones de escritorio necesitan revisar también con la pestaña en segundo plano.
    const background = setInterval(
      () => document.hidden && desktopAlertsSupported() && Notification.permission === "granted" && check(),
      INTERVAL * 2
    );
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      clearInterval(background);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, check]);

  // Contador en el título de la pestaña: "(2) Panel | Geoñuble".
  useEffect(() => {
    if (!enabled) return;
    document.title = `${unread > 0 ? `(${unread}) ` : ""}Panel | Geoñuble Propiedades`;
  }, [enabled, unread]);

  return { unread, alert, dismiss: () => setAlert(null), refresh: check };
}
