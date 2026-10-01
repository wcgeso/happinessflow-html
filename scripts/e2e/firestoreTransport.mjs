// The SDK closes its channel before sending this empty best-effort beacon.
// Keep it as transport evidence; it cannot acknowledge a game transaction.
export const isFirestoreTransportCleanup = (url, status, body) => {
  if (status !== 400 || body.trim()) return false;
  try {
    const request = new URL(url);
    return ['localhost', '127.0.0.1', '[::1]', 'firestore.googleapis.com'].includes(request.hostname) &&
      /\/google\.firestore\.v1\.Firestore\/(Write|Listen)\/channel$/.test(request.pathname) &&
      request.searchParams.get('TYPE') === 'terminate' && !!request.searchParams.get('SID');
  } catch { return false; }
};
