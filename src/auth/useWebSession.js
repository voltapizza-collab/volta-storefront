import { useCallback, useEffect, useState } from 'react';
import api from '../setupAxios';
import { accessDestination, businessAccessPath, forgetSession, matchesDestination, readSavedSession, setCurrentSession, storeSession } from './webSession';

export default function useWebSession(role, native = false) {
  const [session, updateSession] = useState(() => native ? window.__voltaSession || null : null);
  const [checking, setChecking] = useState(!native);
  useEffect(() => {
    if (native) return undefined;
    let alive = true;
    setCurrentSession(null);
    const target = { ...accessDestination(), role };
    const saved = new URLSearchParams(window.location.search).has('reset') ? null : readSavedSession(target);
    const restore = async () => {
      try {
        if (!saved) return;
        const response = await api.get('/api/auth/session', {
          headers: { Authorization: `Bearer ${saved.sessionToken}` },
          params: { role, partnerSlug: target.partnerSlug, storeSlug: target.storeSlug },
        });
        const verified = { ...response.data, sessionToken: saved.sessionToken };
        if (alive && matchesDestination(verified, target)) { storeSession(verified); updateSession(verified); }
      } catch { if (alive) forgetSession(saved); }
      finally { if (alive) setChecking(false); }
    };
    restore();
    const expired = () => { if (alive) { updateSession(null); setChecking(false); } };
    window.addEventListener('volta-session-expired', expired);
    return () => { alive = false; setCurrentSession(null); window.removeEventListener('volta-session-expired', expired); };
  }, [role, native]);

  const setSession = useCallback(next => {
    if (native) { updateSession(next); return; }
    if (!next) {
      if (session?.sessionToken) api.delete('/api/auth/session', { headers: { Authorization: `Bearer ${session.sessionToken}` } }).catch(() => {});
      forgetSession(session);
      updateSession(null);
      return;
    }
    if (!matchesDestination(next, { ...accessDestination(), role })) throw new Error('business_mismatch');
    storeSession(next);
    // Keep query state (e.g. SMS payment return) while giving bookmarks a business destination.
    window.history.replaceState(window.history.state, '', `${businessAccessPath(next)}${window.location.search}`);
    updateSession(next);
  }, [role, native, session]);
  return [session, setSession, checking];
}
