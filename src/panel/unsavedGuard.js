// Indica si el formulario abierto tiene cambios sin guardar, para que el menú
// lateral pueda avisar antes de salir (BrowserRouter no permite bloquear la navegación).
export const unsavedGuard = { dirty: false };

export const LEAVE_MESSAGE =
  "Tienes cambios sin guardar (por ejemplo, fotos nuevas). Si sales, se perderán. ¿Salir igual?";
