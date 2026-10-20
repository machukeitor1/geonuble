import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/contexts";

function Login() {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.currentTarget));
    setSending(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="" />
        <h1>Acceso administrador y corredores</h1>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          Email
          <input type="email" name="email" autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          Contraseña
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn" disabled={sending}>
          {sending ? "Ingresando…" : "Ingresar"}
        </button>
        <Link to="/">← Volver al sitio</Link>
      </form>
    </div>
  );
}

export default Login;
