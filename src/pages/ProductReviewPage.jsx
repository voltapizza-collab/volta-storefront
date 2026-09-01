import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../setupAxios";
import "../styles/ProductReview.css";

const VOTE_LIKE = "LIKE";
const VOTE_DISLIKE = "DISLIKE";
const numberFormatter = new Intl.NumberFormat("es-ES");

const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const formatPreviousLikes = (value) => {
  const likes = Number(value || 0);
  return `${formatNumber(likes)} ${likes === 1 ? "like previo" : "likes previos"}`;
};

const getItemLabel = (item) =>
  [item?.quantity && Number(item.quantity) > 1 ? `${item.quantity}x` : "", item?.name, item?.size]
    .filter(Boolean)
    .join(" ");

export default function ProductReviewPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(null);
  const [votes, setVotes] = useState({});

  const loadReview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get(`/api/product-reviews/${token}`);
      const nextReview = data?.review || null;
      setReview(nextReview);

      const nextVotes = {};
      (nextReview?.items || []).forEach((item) => {
        if (item.vote === VOTE_LIKE || item.vote === VOTE_DISLIKE) {
          nextVotes[item.lineKey] = item.vote;
        }
      });
      setVotes(nextVotes);
    } catch (reviewError) {
      setError(reviewError.response?.data?.error || "No pudimos cargar esta valoracion.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const items = useMemo(() => (Array.isArray(review?.items) ? review.items : []), [review?.items]);
  const selectedCount = Object.values(votes).filter(Boolean).length;
  const storePath =
    review?.partnerSlug && review?.storeSlug ? `/${review.partnerSlug}/${review.storeSlug}` : "/";

  const setVote = (lineKey, vote) => {
    setVotes((current) => ({ ...current, [lineKey]: vote }));
    setMessage("");
  };

  const voteAll = (vote) => {
    const nextVotes = {};
    items.forEach((item) => {
      nextVotes[item.lineKey] = vote;
    });
    setVotes(nextVotes);
    setMessage("");
  };

  const submitVotes = async (event) => {
    event.preventDefault();
    const payload = items
      .map((item) => ({
        lineKey: item.lineKey,
        vote: votes[item.lineKey],
      }))
      .filter((item) => item.vote === VOTE_LIKE || item.vote === VOTE_DISLIKE);

    if (!payload.length) {
      setMessage("Selecciona Like o Dislike en al menos un producto.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const { data } = await api.post(`/api/product-reviews/${token}`, {
        votes: payload,
      });

      const updatedVotes = {};
      (data?.items || []).forEach((item) => {
        if (item.vote === VOTE_LIKE || item.vote === VOTE_DISLIKE) {
          updatedVotes[item.lineKey] = item.vote;
        }
      });
      setVotes(updatedVotes);
      setReview((current) => ({
        ...(current || {}),
        status: data?.status || "RESPONDED",
        items: (data?.items || current?.items || []).map((item) => {
          const currentItem = (current?.items || []).find((candidate) => candidate.lineKey === item.lineKey);
          return {
            ...item,
            previousLikes: item.previousLikes ?? currentItem?.previousLikes ?? 0,
          };
        }),
      }));
      setMessage("Gracias. Tu valoracion quedo guardada.");
    } catch (saveError) {
      setMessage(saveError.response?.data?.error || "No pudimos guardar la valoracion.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="pr-page">
        <section className="pr-card">Cargando valoracion...</section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pr-page">
        <section className="pr-card pr-error">
          <span>Valoracion</span>
          <h1>No encontramos este enlace</h1>
          <p>{error}</p>
          <Link to="/" className="pr-btn">Volver</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="pr-page">
      <section className="pr-card">
        <div className="pr-head">
          <span>{review?.storeName || "Pedido"}</span>
          <h1>Valora tus pizzas</h1>
          <p>
            Pedido <b>{review?.orderCode}</b>
            {review?.customerName ? ` para ${review.customerName}` : ""}
          </p>
        </div>

        <div className="pr-actions">
          <button type="button" onClick={() => voteAll(VOTE_LIKE)}>
            Like a todo
          </button>
        </div>

        <form className="pr-form" onSubmit={submitVotes}>
          <div className="pr-list">
            {items.map((item) => (
              <article key={item.lineKey} className="pr-item">
                <div className="pr-itemImage">
                  {item.image ? <img src={item.image} alt={item.name} /> : <span>Pizza</span>}
                </div>
                <div className="pr-itemBody">
                  <strong>{getItemLabel(item)}</strong>
                  <div className="pr-itemMeta">
                    <small>{item.productId ? `Producto #${item.productId}` : "Producto personalizado"}</small>
                    <span>{formatPreviousLikes(item.previousLikes)}</span>
                  </div>
                  <div className="pr-voteRow">
                    <button
                      type="button"
                      className={votes[item.lineKey] === VOTE_LIKE ? "is-active" : ""}
                      onClick={() => setVote(item.lineKey, VOTE_LIKE)}
                    >
                      Like
                    </button>
                    <button
                      type="button"
                      className={votes[item.lineKey] === VOTE_DISLIKE ? "is-active is-dislike" : ""}
                      onClick={() => setVote(item.lineKey, VOTE_DISLIKE)}
                    >
                      Dislike
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {message && <div className="pr-message">{message}</div>}

          <button type="submit" className="pr-btn" disabled={saving || selectedCount === 0}>
            {saving ? "Guardando..." : `Enviar valoracion (${selectedCount})`}
          </button>
        </form>

        <Link to={storePath} className="pr-link">
          Volver a la tienda
        </Link>
      </section>
    </main>
  );
}
