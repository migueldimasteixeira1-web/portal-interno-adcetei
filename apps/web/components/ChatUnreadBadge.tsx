"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const POLL_INTERVAL_MS = 15000;

export default function ChatUnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      void api.chatUnreadCount().then((result) => {
        if (!cancelled) setCount(result.unread_count);
      }).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!count) return null;
  return (
    <span className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
