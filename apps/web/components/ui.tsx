"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx, type ClassValue } from "clsx";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import React, { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buttonStyles({ variant = "primary", size = "md", className }: { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; className?: string } = {}) {
  const variants = {
    primary: "border border-[#164f84] bg-[#1a5f9e] text-white hover:bg-[#164f84] disabled:border-[#c5cdd8] disabled:bg-[#c5cdd8] disabled:text-[#8b97a8]",
    secondary: "border border-[#d4dbe4] bg-white text-[#1a2332] hover:border-[#1a5f9e] hover:bg-[#f3f7fb] disabled:text-[#8b97a8]",
    ghost: "border border-transparent text-[#5c6b7e] hover:bg-[#e8edf2] hover:text-[#1a2332] disabled:text-[#8b97a8]",
    danger: "border border-[#b91c1c] bg-[#b91c1c] text-white hover:bg-[#991b1b] disabled:border-[#c5cdd8] disabled:bg-[#c5cdd8]",
  };
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-9 px-4 text-sm" };
  return cn("inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed", variants[variant], sizes[size], className);
}

export function Button({ className, variant = "primary", size = "md", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return <button className={buttonStyles({ variant, size, className })} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold leading-tight", className)}>{children}</span>;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={cn("h-9 w-full rounded-md border border-[#d4dbe4] bg-white px-3 text-sm text-[#1a2332] outline-none transition placeholder:text-[#8b97a8] focus:border-[#1a5f9e] focus:ring-2 focus:ring-[#e8f1f9] disabled:bg-[#f0f3f7] disabled:text-[#8b97a8]", props.className)} />;
});

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("min-h-28 w-full resize-y rounded-md border border-[#d4dbe4] bg-white px-3 py-2.5 text-sm leading-6 text-[#1a2332] outline-none transition placeholder:text-[#8b97a8] focus:border-[#1a5f9e] focus:ring-2 focus:ring-[#e8f1f9] disabled:bg-[#f0f3f7] disabled:text-[#8b97a8]", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("h-9 w-full rounded-md border border-[#d4dbe4] bg-white px-3 text-sm text-[#1a2332] outline-none transition focus:border-[#1a5f9e] focus:ring-2 focus:ring-[#e8f1f9] disabled:bg-[#f0f3f7] disabled:text-[#8b97a8]", props.className)} />;
}

export function Field({
  label,
  help,
  error,
  id,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  id?: string;
  children: ReactNode;
}) {
  const generatedId = React.useId();
  const controlId = id || generatedId;
  const descriptionId = help || error ? `${controlId}-description` : undefined;
  const childItems = React.Children.toArray(children);
  const control = childItems[0];
  const enhancedControl = React.isValidElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>(control)
    ? React.cloneElement(control, {
        id: control.props.id || controlId,
        "aria-describedby": control.props["aria-describedby"] || descriptionId,
        "aria-invalid": control.props["aria-invalid"] || Boolean(error),
      })
    : control;

  return (
    <div className="block space-y-1.5">
      <label htmlFor={controlId} className="block text-sm font-semibold text-[#1a2332]">{label}</label>
      {enhancedControl}
      {childItems.slice(1)}
      {(help || error) && (
        <p id={descriptionId} className={cn("text-xs leading-5", error ? "text-[#991b1b]" : "text-[#5c6b7e]")}>
          {error || help}
        </p>
      )}
    </div>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "danger" | "warning"; children: ReactNode; className?: string }) {
  const styles = {
    info: "border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]",
    success: "border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]",
    danger: "border-[#f5c2c2] bg-[#fef2f2] text-[#991b1b]",
    warning: "border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" || tone === "warning" ? AlertCircle : Info;
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-md border px-4 py-3 text-sm leading-6", styles[tone], className)}><Icon className="mt-0.5 shrink-0" size={17} /><div>{children}</div></div>;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
    {icon && <div className="mb-3 grid h-10 w-10 place-items-center rounded-md border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]">{icon}</div>}
    <p className="font-semibold text-[#1a2332]">{title}</p>
    {description && <p className="mt-1 max-w-md text-sm leading-6 text-[#5c6b7e]">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-[#e8edf2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <div>
      <h2 className="text-sm font-semibold text-[#1a2332]">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-[#5c6b7e]">{description}</p>}
    </div>
    {action}
  </div>;
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel-flat flex flex-wrap items-center gap-3 p-3", className)}>{children}</div>;
}

export function FilterChip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
        active
          ? "border-[#1a5f9e] bg-[#1a5f9e] text-white"
          : "border-[#d4dbe4] bg-white text-[#5c6b7e] hover:border-[#1a5f9e] hover:text-[#1a5f9e]",
      )}
    >
      {children}
    </button>
  );
}

export function DetailRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("py-2", className)}>
      <p className="text-xs font-medium text-[#8b97a8]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[#1a2332]">{value}</p>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading,
  confirmDisabled,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0a1f33]/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[#d4dbe4] bg-white shadow-[0_8px_32px_rgba(15,35,60,0.16)] outline-none">
          <div className="max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-[#1a2332]">{title}</Dialog.Title>
                {description && <Dialog.Description className="mt-1 text-sm leading-6 text-[#5c6b7e]">{description}</Dialog.Description>}
              </div>
              <Dialog.Close aria-label="Fechar" className="rounded-md p-1.5 text-[#5c6b7e] hover:bg-[#e8edf2]"><X size={17} /></Dialog.Close>
            </div>
            {children && <div className="mt-4">{children}</div>}
            <div className="mt-5 flex justify-end gap-2 border-t border-[#e8edf2] pt-4">
              <Button variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
              <Button disabled={loading || confirmDisabled} onClick={onConfirm}>{loading ? "Salvando..." : confirmLabel}</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
