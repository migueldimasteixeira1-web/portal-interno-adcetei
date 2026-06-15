import { AlertTriangle, ArrowDown, ArrowUp, Circle, Minus } from "lucide-react";
import { priorityLabels, priorityTone, statusLabels, statusTone } from "@/lib/format";
import { Badge } from "./ui";

const priorityIcons: Record<string, typeof Minus> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  critical: AlertTriangle,
};

export function StatusChip({ status }: { status: string }) {
  return (
    <Badge className={statusTone(status)}>
      <Circle size={8} fill="currentColor" className="opacity-60" />
      {statusLabels[status] || status}
    </Badge>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  const Icon = priorityIcons[priority] || Minus;
  return (
    <Badge className={priorityTone(priority)}>
      <Icon size={12} strokeWidth={2.5} />
      {priorityLabels[priority] || priority}
    </Badge>
  );
}
