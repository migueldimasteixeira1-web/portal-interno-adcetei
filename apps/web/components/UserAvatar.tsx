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
    default: "bg-[#e8f1f9] text-[#1a5f9e] border border-[#c5daf0]",
    sidebar: "bg-white/15 text-white border border-white/20",
    internal: "bg-[#fffbeb] text-[#92400e] border border-[#fcd9a8]",
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
