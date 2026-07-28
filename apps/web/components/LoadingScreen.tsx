export default function LoadingScreen({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-5 py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--primary)]" />
        <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}
