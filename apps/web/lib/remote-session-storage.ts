const URL_PREFIX = "remote-session-url:";
const META_PREFIX = "remote-session-meta:";

export function storeRemoteSessionLaunch(sessionId: string, embedUrl: string, expiresInSeconds: number) {
  sessionStorage.setItem(`${URL_PREFIX}${sessionId}`, embedUrl);
  sessionStorage.setItem(`${META_PREFIX}${sessionId}`, String(expiresInSeconds));
}

export function readRemoteSessionLaunch(sessionId: string): { embedUrl: string; expiresInSeconds: number } | null {
  const embedUrl = sessionStorage.getItem(`${URL_PREFIX}${sessionId}`);
  if (!embedUrl) return null;
  const expiresRaw = sessionStorage.getItem(`${META_PREFIX}${sessionId}`);
  sessionStorage.removeItem(`${URL_PREFIX}${sessionId}`);
  sessionStorage.removeItem(`${META_PREFIX}${sessionId}`);
  return {
    embedUrl,
    expiresInSeconds: expiresRaw ? Number(expiresRaw) : 3600,
  };
}

export function openRemoteViewerTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openRemoteViewerTabFromGesture(url: string, tab: Window | null) {
  if (tab && !tab.closed) {
    tab.location.replace(url);
    tab.focus();
    return;
  }
  openRemoteViewerTab(url);
}
