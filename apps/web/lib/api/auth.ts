import type { User } from "../types";
import { request } from "./client";

export const authApi = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (payload: { full_name: string; email: string; password: string }) =>
    request<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
  me: () => request<User>("/auth/me"),
};
