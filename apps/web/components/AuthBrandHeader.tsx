import { Building2 } from "lucide-react";

export default function AuthBrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="mb-7 flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--navy-900)] text-white">
        <Building2 size={20} />
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Portal Interno ADCETEI</p>
        {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}
