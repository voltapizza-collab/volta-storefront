import { Routes, Route } from "react-router-dom";
import StorePage from "./pages/StorePage";
import AdminStoresPage from "./pages/AdminStoresPage";

function App() {
  return (
    <Routes>
      {/* rutas específicas primero */}
      <Route path="/admin/stores" element={<AdminStoresPage />} />

      {/* SIEMPRE AL FINAL */}
      <Route path="/:partnerSlug/:storeSlug" element={<StorePage />} />
    </Routes>
  );
}

export default App;