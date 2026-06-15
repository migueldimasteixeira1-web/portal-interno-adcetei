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
        const alignRight = own && !item.internal && !isEvent;

        if (isEvent) {
          return (
            <div key={item.id} className="flex justify-center py-1">
              <div className="flex max-w-xl items-center gap-2 rounded-md border border-[#d4dbe4] bg-[#f7f9fb] px-3 py-1.5 text-xs text-[#5c6b7e]">
                <History size={13} className="shrink-0 text-[#8b97a8]" />
                <span className="font-medium text-[#1a2332]">{item.body}</span>
                <span className="whitespace-nowrap text-[#8b97a8]">{formatDate(item.created_at)}</span>
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
                <span className="font-semibold text-[#1a2332]">{item.author.full_name}</span>
                <span className="text-[#8b97a8]">{roleLabels[item.author.role]}</span>
                {item.internal && (
                  <span className="inline-flex items-center gap-1 rounded border border-[#fcd9a8] bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400e]">
                    <LockKeyhole size={10} /> Interna
                  </span>
                )}
              </div>
              <div className={cn(
                "rounded-md border px-3.5 py-2.5 text-left text-sm leading-6",
                item.internal
                  ? "border-[#fcd9a8] bg-[#fffbeb] text-[#78350f]"
                  : alignRight
                    ? "border-[#c5daf0] bg-[#e8f1f9] text-[#1a2332]"
                    : "border-[#d4dbe4] bg-white text-[#1a2332]",
              )}>
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className={cn("mt-1.5 text-[11px]", alignRight ? "text-[#5c6b7e]" : "text-[#8b97a8]")}>
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
