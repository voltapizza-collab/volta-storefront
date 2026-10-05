import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../setupAxios';
import useWebSession from './useWebSession';
import { accessDestination, sessionKey, matchesDestination, getCurrentSession, setCurrentSession, storeSession } from './webSession';

jest.mock('../setupAxios', () => ({ __esModule: true, default: { get: jest.fn(), delete: jest.fn(() => Promise.resolve()) } }));
const a = { role: 'backoffice', partnerId: 1, partnerSlug: 'a', partnerName: 'Business A', sessionToken: 'a'.repeat(64) };
const b = { role: 'backoffice', partnerId: 2, partnerSlug: 'b', partnerName: 'Business B', sessionToken: 'b'.repeat(64) };
function Probe({ native = false }) {
  const [session, setSession, checking] = useWebSession(native ? 'pos' : 'backoffice', native);
  return <><div>{checking ? 'Checking' : session?.partnerName || 'Login'}</div><button onClick={() => setSession(null)}>Logout</button></>;
}
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); jest.clearAllMocks(); api.delete.mockResolvedValue({}); setCurrentSession(null); window.history.replaceState(null, '', '/backoffice/b'); });

test('business B never restores legacy A or sends private requests for A', async () => {
  localStorage.setItem('volta_backoffice_auth', JSON.stringify(a));
  sessionStorage.setItem(sessionKey(a), JSON.stringify(a));
  render(<Probe />);
  expect(await screen.findByText('Login')).toBeInTheDocument();
  expect(screen.queryByText('Business A')).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
});

test('even a matching browser identity must be verified before data renders', async () => {
  sessionStorage.setItem(sessionKey(b), JSON.stringify(b));
  let resolve;
  api.get.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<Probe />);
  expect(screen.getByText('Checking')).toBeInTheDocument();
  expect(screen.queryByText('Business B')).toBeNull();
  await act(async () => resolve({ data: { ...b, partnerName: 'Verified B' } }));
  expect(screen.getByText('Verified B')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ params: { role: 'backoffice', partnerSlug: 'b', storeSlug: '' } }));
});

test('expired, forged or wrong-business restored sessions display login', async () => {
  sessionStorage.setItem(sessionKey(b), JSON.stringify(b));
  api.get.mockRejectedValue({ response: { status: 401 } });
  render(<Probe />);
  expect(await screen.findByText('Login')).toBeInTheDocument();
  expect(sessionStorage.getItem(sessionKey(b))).toBeNull();
});

test('logout revokes the server token and removes only this business', async () => {
  sessionStorage.setItem(sessionKey(a), JSON.stringify(a));
  sessionStorage.setItem(sessionKey(b), JSON.stringify(b));
  api.get.mockResolvedValue({ data: b });
  render(<Probe />);
  await screen.findByText('Business B');
  fireEvent.click(screen.getByText('Logout'));
  await screen.findByText('Login');
  expect(api.delete).toHaveBeenCalledWith('/api/auth/session', { headers: { Authorization: `Bearer ${b.sessionToken}` } });
  expect(sessionStorage.getItem(sessionKey(b))).toBeNull();
  expect(sessionStorage.getItem(sessionKey(a))).not.toBeNull();
});

test('POS paths bind both partner and store; role boundaries are enforced', () => {
  const session = { ...a, role: 'pos', storeSlug: 'central' };
  expect(matchesDestination(session, accessDestination('/pos/a/central'))).toBe(true);
  expect(matchesDestination(session, accessDestination('/pos/a/second'))).toBe(false);
  expect(matchesDestination(session, accessDestination('/pos/b/central'))).toBe(false);
  expect(matchesDestination(session, accessDestination('/backoffice/a'))).toBe(false);
  expect(accessDestination('/global-manager/anything').partnerSlug).toBe('');
});

test('navigating to another business suppresses the old token immediately', () => {
  window.history.replaceState(null, '', '/backoffice/a');
  storeSession(a);
  expect(getCurrentSession()).toEqual(a);
  window.history.replaceState(null, '', '/backoffice/b');
  expect(getCurrentSession()).toBeNull();
});

test('a password invitation never restores an existing session', async () => {
  window.history.replaceState(null, '', '/backoffice/b?reset=invitation');
  sessionStorage.setItem(sessionKey(b), JSON.stringify(b));
  render(<Probe />);
  expect(await screen.findByText('Login')).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

test('native POS keeps hardware bootstrap and does not call web authentication', () => {
  window.__voltaSession = { partnerName: 'Native business', storeId: 11 };
  render(<Probe native />);
  expect(screen.getByText('Native business')).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  delete window.__voltaSession;
});
