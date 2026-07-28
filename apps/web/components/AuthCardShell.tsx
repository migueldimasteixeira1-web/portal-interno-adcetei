import { ReactNode } from "react";
import { cn } from "@/components/ui";

export default function AuthCardShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-6 sm:px-6">
      <section className={cn("w-full max-w-[500px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-md)] sm:p-8", className)}>
        {children}
      </section>
    </main>
  );
}
