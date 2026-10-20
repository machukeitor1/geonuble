import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/contexts";
import Login from "./Login";
import PanelLayout from "./PanelLayout";
import Dashboard from "./Dashboard";
import PropertiesAdmin from "./PropertiesAdmin";
import PropertyForm from "./PropertyForm";
import UsersAdmin from "./UsersAdmin";
import MessagesAdmin from "./MessagesAdmin";
import CompanySettings from "./CompanySettings";
import QuoteSelect from "./QuoteSelect";
import QuoteBuilder from "./QuoteBuilder";
import QuotesHistory from "./QuotesHistory";
import Profile from "./Profile";
import "./Panel.css";

function AdminOnly({ children }) {
  const { user } = useAuth();
  return user.role === "admin" ? children : <Navigate to="/panel" replace />;
}

function PanelRoutes() {
  const { user } = useAuth();

  if (user === undefined) return <p className="status-message">Cargando…</p>;
  if (!user) return <Login />;

  const admin = (element) => <AdminOnly>{element}</AdminOnly>;

  return (
    <Routes>
      <Route element={<PanelLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="cotizar" element={<QuoteSelect />} />
        <Route path="cotizar/:id" element={<QuoteBuilder />} />
        <Route path="cotizaciones" element={<QuotesHistory />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="propiedades" element={admin(<PropertiesAdmin />)} />
        <Route path="propiedades/nueva" element={admin(<PropertyForm />)} />
        <Route path="propiedades/:id" element={admin(<PropertyForm />)} />
        <Route path="usuarios" element={admin(<UsersAdmin />)} />
        <Route path="mensajes" element={admin(<MessagesAdmin />)} />
        <Route path="empresa" element={admin(<CompanySettings />)} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Route>
    </Routes>
  );
}

export default PanelRoutes;
