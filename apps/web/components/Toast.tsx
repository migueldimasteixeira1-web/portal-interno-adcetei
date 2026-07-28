"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { cn } from "./ui";

export type ToastTone = "info" | "success" | "danger" | "warning";

type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastContextValue = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  info: "border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[var(--status-blue-text)]",
  success: "border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--status-green-text)]",
  danger: "border-[var(--status-red-border)] bg-[var(--status-red-bg)] text-[var(--status-red-text)]",
  warning: "border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] text-[var(--status-amber-text)]",
};

const toneIcon: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  danger: AlertCircle,
  warning: AlertCircle,
};

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback<ToastContextValue>(
    (message, tone = "success") => {
      const id = ++nextId.current;
      setItems((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
      >
        {items.map((item) => {
          const Icon = toneIcon[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border px-4 py-3 text-sm leading-6 shadow-[var(--shadow-md)] motion-safe:animate-[toast-in_0.18s_ease-out]",
                toneStyles[item.tone],
              )}
            >
              <Icon className="mt-0.5 shrink-0" size={17} />
              <p className="flex-1">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Fechar notificação"
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return showToast;
}
