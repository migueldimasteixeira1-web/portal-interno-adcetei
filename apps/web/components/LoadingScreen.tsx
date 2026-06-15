export default function LoadingScreen({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-md border border-[#d4dbe4] bg-white px-5 py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e8edf2] border-t-[#1a5f9e]" />
        <p className="text-sm font-medium text-[#5c6b7e]">{label}</p>
      </div>
    </div>
  );
}
