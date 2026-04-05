import { Routes, Route } from "react-router-dom";
import StorePage from "./pages/StorePage";
import AdminStoresPage from "./pages/AdminStoresPage";
import MenuPage from "./pages/MenuPage";
import GlobalManager from "./pages/GlobalManager";
import Backoffice from "./pages/Backoffice";
import AppLayout from "./components/Layout/AppLayout";

function App() {
  return (
    <AppLayout>
      <Routes>
        {/* ADMIN */}
        <Route path="/admin/stores" element={<AdminStoresPage />} />

        {/* STORE (motor de ventas) */}
        <Route path="/:partnerSlug/:storeSlug" element={<StorePage />} />
        <Route path="/:partnerSlug/:storeSlug/menu" element={<MenuPage />} />

        {/* GLOBAL MANAGER */}
        <Route path="/global-manager/*" element={<GlobalManager />} />

        {/* BACKOFFICE */}
        <Route path="/backoffice/*" element={<Backoffice />} />
      </Routes>
    </AppLayout>
  );
}

export default App;