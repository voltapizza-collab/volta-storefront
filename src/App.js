import { Routes, Route } from "react-router-dom";
import PartnerPage from "./pages/PartnerPage";
import PartnerOrderPage from "./pages/PartnerOrderPage";
import StorePage from "./pages/StorePage";
import AdminStoresPage from "./pages/AdminStoresPage";
import MenuPage from "./pages/MenuPage";
import GlobalManager from "./pages/GlobalManager";
import Backoffice from "./pages/Backoffice";
import CouponGalleryPage from "./pages/CouponGalleryPage";
import GamePage from "./pages/GamePage";
import LandingPage from "./pages/LandingPage";
import ReservationCancelPage from "./pages/ReservationCancelPage";
import AppLayout from "./components/Layout/AppLayout";
import PosApp from "./pos/PosApp";

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* ADMI */}
        <Route path="/admin/stores" element={<AdminStoresPage />} />
        <Route path="/reservation/:id/cancel" element={<ReservationCancelPage />} />

        {/* STORE (motor de vents) */}
        <Route path="/:partnerSlug" element={<PartnerPage />} />
        <Route path="/:partnerSlug/coupons" element={<CouponGalleryPage />} />
        <Route path="/:partnerSlug/games/:gameSlug" element={<GamePage />} />
        <Route path="/:partnerSlug/order" element={<PartnerOrderPage />} />
        <Route path="/:partnerSlug/:storeSlug" element={<StorePage />} />
        <Route path="/:partnerSlug/:storeSlug/menu" element={<MenuPage />} />

        {/* GLOBAL MANAGER */}
        <Route path="/global-manager/*" element={<GlobalManager />} />

        {/* BACKOFFICE */}
        <Route path="/Backoffice/*" element={<Backoffice />} />
        <Route path="/backoffice/*" element={<Backoffice />} />
        <Route path="/pos" element={<PosApp />} />
        <Route path="/jugar" element={<GamePage fixedGameSlug="winning-number" />} />
        <Route path="/perfect-timing" element={<GamePage fixedGameSlug="perfect-timing" />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
