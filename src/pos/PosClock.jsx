import { memo, useEffect, useState } from 'react';
const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const date = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
export default memo(function PosClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <section className="pos-idleClockCard" aria-label="Reloj digital"><strong>{time.format(now)}</strong><small>{date.format(now)}</small></section>;
});
