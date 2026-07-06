import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  updating: boolean;
  hasFilters: boolean;
  onPageChange: (page: number) => void;
};

export default function ListPagination({ page, totalPages, total, updating, hasFilters, onPageChange }: Props) {
  if (total <= 0 && !hasFilters) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-[#e8edf2] bg-[#f7f9fb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#5c6b7e]">
        Página <strong className="text-[#1a2332]">{page}</strong> de <strong className="text-[#1a2332]">{totalPages}</strong>
        <span className="ml-1">· {total} registro(s) no total</span>
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={updating || page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={15} /> Anterior
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={updating || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Próxima <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
