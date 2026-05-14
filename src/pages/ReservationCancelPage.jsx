import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Storefront.css";

export default function ReservationCancelPage() {
  const { id } = useParams();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    const cancelReservation = async () => {
      try {
        await api.patch(`/api/reservations/${id}/cancel`);
        if (!cancelled) setStatus("success");
      } catch (error) {
        console.error(error);
        if (!cancelled) setStatus("error");
      }
    };

    cancelReservation();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="sf-reservationCancelPage">
      <div className="sf-reservationCancelCard">
        <span>MyCrushPizza</span>
        <h1>
          {status === "success"
            ? "Reserva cancelada"
            : status === "error"
            ? "No pudimos cancelar la reserva"
            : "Cancelando reserva..."}
        </h1>
        <p>
          {status === "success"
            ? "Hemos actualizado el estado de tu reserva."
            : status === "error"
            ? "Intentalo de nuevo o contacta con la tienda."
            : "Estamos procesando tu solicitud."}
        </p>
      </div>
    </div>
  );
}
