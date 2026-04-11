import { Navigate, useParams } from "react-router-dom";

export default function MenuPage() {
  const { partnerSlug, storeSlug } = useParams();
  return <Navigate to={`/${partnerSlug}/${storeSlug}`} replace />;
}
