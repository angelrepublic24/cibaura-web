"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  NotificationsApi,
  notificationKeys,
  type AppNotification,
} from "@/features/notifications/api";
import { useAuthStore } from "@/shared/auth/store";
import { cn } from "@/lib/utils";

/**
 * Notification bell — an unread badge fed by a lightweight polling count, and a
 * dropdown that loads the feed on open. Opening a notification marks it read and
 * follows its link; "Mark all read" clears the badge. Renders nothing for guests.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const authed = status === "authenticated";

  const unreadQuery = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: NotificationsApi.unreadCount,
    enabled: authed,
    refetchInterval: 60_000,
  });

  const listQuery = useQuery({
    queryKey: notificationKeys.list(),
    queryFn: NotificationsApi.list,
    enabled: authed && open,
  });

  const markAll = useMutation({
    mutationFn: NotificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => NotificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!authed) return null;

  const unread = unreadQuery.data ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Notifications
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {listQuery.isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : (listQuery.data?.length ?? 0) === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {listQuery.data!.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onOpen={() => {
                      if (!n.read) markOne.mutate(n.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  n,
  onOpen,
}: {
  n: AppNotification;
  onOpen: () => void;
}) {
  const inner = (
    <div className={cn("flex gap-3 px-4 py-3", !n.read && "bg-primary/5")}>
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          n.read ? "bg-transparent" : "bg-primary",
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{n.title}</p>
        {n.body ? (
          <p className="truncate text-xs text-muted-foreground">{n.body}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {timeAgo(n.createdAt)}
        </p>
      </div>
    </div>
  );

  return (
    <li className="transition-colors hover:bg-muted">
      {n.linkUrl ? (
        <Link href={n.linkUrl} onClick={onOpen} className="block">
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className="block w-full text-left">
          {inner}
        </button>
      )}
    </li>
  );
}

/** Compact relative time, e.g. "3h", "2d". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
