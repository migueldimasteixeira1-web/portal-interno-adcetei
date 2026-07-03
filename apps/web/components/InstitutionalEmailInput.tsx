import { Input, cn } from "@/components/ui";
import type { InputHTMLAttributes } from "react";

export const institutionalEmailSuffix = ".cabofrio.rj.gov.br";

export function institutionalEmailPrefix(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(institutionalEmailSuffix)
    ? normalized.slice(0, -institutionalEmailSuffix.length)
    : normalized;
}

export function institutionalEmailFromPrefix(prefix: string) {
  const normalized = institutionalEmailPrefix(prefix);
  return normalized ? `${normalized}${institutionalEmailSuffix}` : "";
}

export function InstitutionalEmailInput({
  value,
  onChangeValue,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChangeValue: (value: string) => void;
}) {
  return (
    <div className={cn("flex", className)}>
      <Input
        {...props}
        type="text"
        value={institutionalEmailPrefix(value)}
        onChange={(event) => onChangeValue(institutionalEmailFromPrefix(event.target.value))}
        className="rounded-r-none border-r-0"
      />
      <span className="inline-flex h-9 shrink-0 items-center rounded-r-md border border-l-0 border-[#d4dbe4] bg-[#f7f9fb] px-3 text-sm font-medium text-[#5c6b7e]">
        {institutionalEmailSuffix}
      </span>
    </div>
  );
}
