let currentSession = null;

export function accessDestination(pathname = window.location.pathname) {
  const [surface, partner, store] = pathname.split('/').filter(Boolean);
  let partnerSlug = '', storeSlug = '';
  try { partnerSlug = decodeURIComponent(partner || ''); storeSlug = decodeURIComponent(store || ''); } catch { /* No matching session. */ }
  const role = surface?.toLowerCase() === 'backoffice' ? 'backoffice' : surface === 'pos' ? 'pos' : surface === 'global-manager' ? 'global_admin' : null;
  if (role !== 'backoffice' && role !== 'pos') partnerSlug = '';
  return { role, partnerSlug, storeSlug: role === 'pos' ? storeSlug : '' };
}

export function matchesDestination(session, target = accessDestination()) {
  return Boolean(session?.sessionToken && session.role === target.role &&
    (!target.partnerSlug || session.partnerSlug === target.partnerSlug) &&
    (!target.storeSlug || session.storeSlug === target.storeSlug));
}

export function sessionKey(target) {
  return `volta_web_session:${target.role}:${target.partnerSlug || ''}:${target.role === 'pos' ? target.storeSlug || '' : ''}`;
}

export function readSavedSession(target) {
  // Legacy values are unsigned, shared between businesses and must never be restored.
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey(target)) || 'null');
    return matchesDestination(session, target) ? session : null;
  } catch { return null; }
}

export function setCurrentSession(session) { currentSession = session; }
export function getCurrentSession() { return matchesDestination(currentSession) ? currentSession : null; }

export function storeSession(session) {
  currentSession = session;
  try { sessionStorage.setItem(sessionKey(session), JSON.stringify(session)); } catch { /* Memory-only access still works. */ }
}

export function forgetSession(session = currentSession) {
  currentSession = null;
  try { if (session) sessionStorage.removeItem(sessionKey(session)); } catch { /* Storage may be disabled. */ }
}

export function businessAccessPath(session) {
  if (session.role === 'global_admin') return '/global-manager';
  const partner = encodeURIComponent(session.partnerSlug);
  return session.role === 'pos' ? `/pos/${partner}/${encodeURIComponent(session.storeSlug)}` : `/backoffice/${partner}`;
}
