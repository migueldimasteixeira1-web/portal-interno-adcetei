"use client";

import { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./Toast";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
