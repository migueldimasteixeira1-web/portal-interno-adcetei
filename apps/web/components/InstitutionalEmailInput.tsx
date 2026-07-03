import { Input } from "@/components/ui";
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

export function completeInstitutionalEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.endsWith(".")) return `${normalized}${institutionalEmailSuffix.slice(1)}`;
  return normalized.endsWith(institutionalEmailSuffix) ? normalized : institutionalEmailFromPrefix(normalized);
}

function shouldCompleteAfterSecretariaDot(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("@") &&
    normalized.endsWith(".") &&
    !normalized.endsWith(institutionalEmailSuffix)
  );
}

export function InstitutionalEmailInput({
  value,
  onChangeValue,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChangeValue: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      type="email"
      value={value}
      onBlur={(event) => onChangeValue(completeInstitutionalEmail(event.target.value))}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChangeValue(
          shouldCompleteAfterSecretariaDot(nextValue)
            ? completeInstitutionalEmail(nextValue)
            : nextValue
        );
      }}
    />
  );
}
