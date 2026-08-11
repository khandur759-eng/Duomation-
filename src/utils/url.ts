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
  if (typeof socketEnv === 'string') socketEnv = socketEnv.trim();

  const isProd = (import.meta as any).env?.PROD || (import.meta as any).env?.MODE === 'production';

  // 1. If VITE_SOCKET_URL is explicitly configured, validate and normalize it
  if (socketEnv) {
    try {
      const parsed = new URL(socketEnv);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        let clean = parsed.origin;
        if (clean.endsWith('/')) {
          clean = clean.slice(0, -1);
        }
        return clean;
      }
    } catch (e) {
      console.error('[Duomation Config] Invalid VITE_SOCKET_URL format:', socketEnv, e);
    }
  }

  // 2. In development mode, the local server hosts both frontend and Socket.IO on window.location.origin
  if (!isProd && typeof window !== 'undefined' && window.location?.origin) {
    let clean = window.location.origin;
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  }

  // 3. In production, if VITE_SOCKET_URL is absent, return empty string so client knows Socket.IO is unconfigured
  // rather than attempting to connect to a static frontend host (e.g. Vercel) which does not run Socket.IO.
  return '';
}

export function logDuomationConfig() {
  if (typeof window === 'undefined') return;
  const mode = (import.meta as any).env?.MODE || 'production';
  const isProd = (import.meta as any).env?.PROD || mode === 'production';
  const appUrl = getPublicAppUrl();
  const socketUrl = getSocketUrl();
  const origin = window.location.origin;
  const hasDedicatedSocketUrl = Boolean((import.meta as any).env?.VITE_SOCKET_URL);

  console.info('[Duomation Config]', {
    mode,
    isProd,
    appUrl,
    socketUrl: socketUrl || '(Not configured - missing VITE_SOCKET_URL)',
    hasDedicatedSocketUrl,
    origin,
  });
}


