import { History, LockKeyhole, MessageSquareText } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { EmptyState, cn } from "./ui";
import { formatDate, roleLabels } from "@/lib/format";
import type { TicketComment, User } from "@/lib/types";

export default function TicketTimeline({ comments, currentUser }: { comments: TicketComment[]; currentUser: User }) {
  if (!comments.length) {
    return <EmptyState icon={<MessageSquareText size={18} />} title="Ainda não há interações" description="As respostas e atualizações deste chamado aparecerão aqui." />;
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {comments.map((item) => {
        const own = item.author.id === currentUser.id;
        const isEvent = item.event_type !== "comment";
        const alignRight = own && !isEvent;

        if (isEvent) {
          return (
            <div key={item.id} className="flex justify-center py-1">
              <div className="flex max-w-xl items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--muted)]">
                <History size={13} className="shrink-0 text-[var(--muted-light)]" />
                <span className="font-medium text-[var(--foreground)]">{item.body}</span>
                <span className="whitespace-nowrap text-[var(--muted-light)]">{formatDate(item.created_at)}</span>
              </div>
            </div>
          );
        }

        return (
          <div key={item.id} className={cn("flex gap-2.5", alignRight ? "flex-row-reverse" : "flex-row")}>
            <UserAvatar
              name={item.author.full_name}
              size="sm"
              variant={item.internal ? "internal" : "default"}
            />
            <div className={cn("min-w-0 max-w-[80%]", alignRight && "text-right")}>
              <div className={cn("mb-1 flex items-center gap-2 text-xs", alignRight && "justify-end")}>
                <span className="font-semibold text-[var(--foreground)]">{item.author.full_name}</span>
                <span className="text-[var(--muted-light)]">{roleLabels[item.author.role]}</span>
                {item.internal && (
                  <span className="inline-flex items-center gap-1 rounded border border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-amber-text)]">
                    <LockKeyhole size={10} /> Interna
                  </span>
                )}
              </div>
              <div className={cn(
                "rounded-md border px-3.5 py-2.5 text-left text-sm leading-6",
                item.internal
                  ? "border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] text-[var(--status-amber-text)]"
                  : alignRight
                    ? "border-[var(--status-blue-border)] bg-[var(--blue-100)] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
              )}>
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className={cn("mt-1.5 text-[11px]", alignRight ? "text-[var(--muted)]" : "text-[var(--muted-light)]")}>
                  {formatDate(item.created_at)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
