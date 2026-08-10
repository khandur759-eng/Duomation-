export function getPublicAppUrl(): string {
  let url =
    (import.meta as any).env?.VITE_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
    // If running in browser and location exists, prefer location.origin if env wasn't set
    if (typeof window !== 'undefined' && window.location?.origin) {
      url = window.location.origin;
    }
  }

  // Strip trailing slash
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
}

export function getSocketUrl(): string {
  let url =
    (import.meta as any).env?.VITE_SOCKET_URL ||
    (import.meta as any).env?.VITE_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
}
