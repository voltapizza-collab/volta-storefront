export function formatCouponValidity(secondsLeft) {
  if (!Number.isFinite(secondsLeft)) return "No disponible";
  if (secondsLeft <= 0) return "Caducado";
  if (secondsLeft >= 86400) {
    const days = Math.floor(secondsLeft / 86400);
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  const minutes = Math.ceil(secondsLeft / 60);
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
