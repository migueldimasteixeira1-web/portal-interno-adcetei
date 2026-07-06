const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
export const SESSION_EXPIRED_EVENT = "pti:session-expired";
export const SESSION_MESSAGE_KEY = "pti_session_message";
let sessionExpiryInProgress = false;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pti_token");
}

function clearStoredSession() {
  localStorage.removeItem("pti_token");
  localStorage.removeItem("pti_user");
}

export function resetSessionExpiryGuard() {
  sessionExpiryInProgress = false;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {}
    if (response.status === 401 && typeof window !== "undefined" && token) {
      clearStoredSession();
      if (!sessionExpiryInProgress) {
        sessionExpiryInProgress = true;
        sessionStorage.setItem(SESSION_MESSAGE_KEY, "Sua sessão expirou. Entre novamente.");
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}
