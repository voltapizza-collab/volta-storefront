import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "volta:catalog-swipe-hint:v1";

export default function CatalogSwipeHint({ active, categoryId }) {
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);
  const initialCategory = useRef(null);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    if (shown.current) {
      if (categoryId !== initialCategory.current) setVisible(false);
      return;
    }
    shown.current = true;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // The in-memory flag still prevents repeats when browser storage is unavailable.
    }
    initialCategory.current = categoryId;
    setVisible(true);
  }, [active, categoryId]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!active || !visible || categoryId !== initialCategory.current) return null;
  return <div className="sf-catalogSwipeHint" role="status">
    <svg className="sf-catalogSwipeHint__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4" />
    </svg>
    <span>Desliza para cambiar de categoría</span>
  </div>;
}
