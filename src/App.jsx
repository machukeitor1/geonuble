import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, SettingsProvider } from "./context/Providers";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

// El panel (admin y corredores) se carga aparte para no pesar en el sitio público.
const PanelRoutes = lazy(() => import("./panel/PanelRoutes"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/propiedades" element={<Properties />} />
              <Route path="/propiedades/:id" element={<PropertyDetail />} />
              <Route path="/contacto" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route
              path="/panel/*"
              element={
                <Suspense fallback={<p className="status-message">Cargando panel…</p>}>
                  <PanelRoutes />
                </Suspense>
              }
            />
          </Routes>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
