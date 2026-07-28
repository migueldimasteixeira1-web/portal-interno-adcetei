import { initials } from "@/lib/format";
import { cn } from "./ui";

export default function UserAvatar({
  name,
  size = "md",
  variant = "default",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  variant?: "default" | "sidebar" | "internal";
  className?: string;
}) {
  const sizes = { sm: "h-8 w-8 text-[10px]", md: "h-9 w-9 text-xs" };
  const variants = {
    default: "bg-[var(--blue-100)] text-[var(--primary)] border border-[var(--status-blue-border)]",
    sidebar: "bg-white/15 text-white border border-white/20",
    internal: "bg-[var(--status-amber-bg)] text-[var(--status-amber-text)] border border-[var(--status-amber-border)]",
  };

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold",
        sizes[size],
        variants[variant],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
