export function getPublicAppUrl(): string {
  let envUrl = (import.meta as any).env?.VITE_APP_URL;
  if (typeof envUrl === 'string') {
    envUrl = envUrl.trim();
  }

  let url = envUrl || '';

  if (!url && typeof window !== 'undefined' && window.location?.origin) {
    url = window.location.origin;
  }

  // Validate and normalize
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Strip trailing slash
        let clean = parsed.origin + parsed.pathname;
        if (clean.endsWith('/')) {
          clean = clean.slice(0, -1);
        }
        return clean;
      }
    } catch (e) {}
  }

  // Fallback to window.location.origin in browser
  if (typeof window !== 'undefined' && window.location?.origin) {
    let clean = window.location.origin;
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  }

  return '';
}

export function getSocketUrl(): string {
  let socketEnv = (import.meta as any).env?.VITE_SOCKET_URL;
  let appEnv = (import.meta as any).env?.VITE_APP_URL;

  if (typeof socketEnv === 'string') socketEnv = socketEnv.trim();
  if (typeof appEnv === 'string') appEnv = appEnv.trim();

  let raw = socketEnv || appEnv || (typeof window !== 'undefined' ? window.location.origin : '');

  if (raw) {
    try {
      const parsed = new URL(raw);
      let clean = parsed.origin;
      if (clean.endsWith('/')) {
        clean = clean.slice(0, -1);
      }
      return clean;
    } catch (e) {}
  }

  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function logDuomationConfig() {
  if (typeof window === 'undefined') return;
  const mode = (import.meta as any).env?.MODE || 'production';
  const appUrl = getPublicAppUrl();
  const socketUrl = getSocketUrl();
  const origin = window.location.origin;
  const protocol = window.location.protocol;

  console.info('[Duomation Config]', {
    mode,
    appUrl,
    socketUrl,
    origin,
    protocol,
  });
}

