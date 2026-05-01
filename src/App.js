import { Routes, Route } from "react-router-dom";
import PartnerPage from "./pages/PartnerPage";
import PartnerOrderPage from "./pages/PartnerOrderPage";
import StorePage from "./pages/StorePage";
import AdminStoresPage from "./pages/AdminStoresPage";
import MenuPage from "./pages/MenuPage";
import GlobalManager from "./pages/GlobalManager";
import Backoffice from "./pages/Backoffice";
import CouponGalleryPage from "./pages/CouponGalleryPage";
import LandingPage from "./pages/LandingPage";
import AppLayout from "./components/Layout/AppLayout";

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* ADMI */}
        <Route path="/admin/stores" element={<AdminStoresPage />} />

        {/* STORE (motor de vents) */}
        <Route path="/:partnerSlug" element={<PartnerPage />} />
        <Route path="/:partnerSlug/coupons" element={<CouponGalleryPage />} />
        <Route path="/:partnerSlug/order" element={<PartnerOrderPage />} />
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
