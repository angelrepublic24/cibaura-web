"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { BookingsApi, bookingKeys } from "@/features/bookings/api";
import type { Booking, Message } from "@/shared/types/domain";
import { useAuthStore } from "@/shared/auth/store";
import { EmptyState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";

/** Mirrors SendMessageDto (@MaxLength(4000)). */
const MAX_LEN = 4000;
/** Poll cadence for near-realtime; a websocket can replace it later. */
const POLL_MS = 8000;
/** Auto-scroll only when the viewer is within this many px of the bottom. */
const STICK_THRESHOLD_PX = 80;

/** "3:45 PM" for a message sent today, else "Aug 2, 3:45 PM". */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${date}, ${time}`;
}

/**
 * Per-booking chat between the renter and the agency (one thread per booking).
 *
 * Three viewer roles, resolved from the session:
 *  - AGENCY  — manages this booking's agency; own replies on the right.
 *  - CUSTOMER — the renter; own messages on the right.
 *  - OBSERVER — a platform_admin who does not manage the agency. The backend
 *    grants admins the thread for oversight, but they are NOT a party: the panel
 *    renders READ-ONLY and never attributes the renter's messages to them
 *    ("You"). (An admin who is themselves the renter degrades to read-only —
 *    the safe direction — since the booking wire type doesn't expose the
 *    customer id to positively identify them.)
 *
 * The server derives `senderRole` from the booking's customer id, so individual
 * agency staff ids are never distinguished (all agency-side reads as "agency").
 *
 * Near-realtime is polling (refetch every {@link POLL_MS} while the tab is
 * focused). Auto-scroll sticks to the newest message only when the viewer is
 * already near the bottom, so an inbound message never yanks someone who
 * scrolled up to re-read history.
 */
export function ChatPanel({ booking }: { booking: Booking }) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the viewer is pinned to the bottom (so new messages should scroll).
  const stickRef = useRef(true);

  const viewerIsAgency =
    !!user?.agencyId && user.agencyId === booking.agency.id;
  // A platform_admin who doesn't manage this agency can read (oversight) but is
  // not a chat participant — read-only, no "You" attribution, no composer.
  const viewerIsObserver =
    !viewerIsAgency && !!user?.roles.includes("platform_admin");

  const query = useQuery({
    queryKey: bookingKeys.messages(booking.id),
    queryFn: () => BookingsApi.listMessages(booking.id),
    refetchInterval: POLL_MS,
  });

  const messages = query.data ?? [];

  const send = useMutation({
    mutationFn: (text: string) => BookingsApi.sendMessage(booking.id, text),
    onSuccess: () => {
      setBody("");
      stickRef.current = true; // pin so my own message scrolls into view
      qc.invalidateQueries({ queryKey: bookingKeys.messages(booking.id) });
    },
  });

  // Keep the newest message in view — but ONLY when the viewer is already near
  // the bottom, so a poll delivering someone else's message doesn't interrupt
  // reading history. Runs on count change (a new message), not every render.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    stickRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
  }

  const isMine = (m: Message) =>
    !viewerIsObserver &&
    m.senderRole === (viewerIsAgency ? "agency" : "customer");

  const senderLabel = (m: Message) =>
    isMine(m)
      ? "You"
      : m.senderRole === "customer"
        ? "Renter"
        : booking.agency.name;

  const title = viewerIsObserver
    ? "Booking chat (admin view)"
    : viewerIsAgency
      ? "Chat with the renter"
      : "Chat with the agency";

  return (
    <Card className="flex h-fit flex-col lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-80 space-y-3 overflow-y-auto pr-1"
        >
          {query.isLoading ? (
            <LoadingState label="Loading messages…" className="py-6" />
          ) : query.isError ? (
            <p className="text-sm text-muted-foreground">
              Messages could not be loaded.
            </p>
          ) : messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Coordinate pickup, timing and the meet-up here."
              className="py-6"
            />
          ) : (
            messages.map((m) => {
              const mine = isMine(m);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  <span className="px-1 text-[11px] text-muted-foreground">
                    {senderLabel(m)} · {formatMessageTime(m.createdAt)}
                  </span>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {viewerIsObserver ? (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Read-only — you are viewing this conversation as an admin.
          </p>
        ) : (
          <form className="space-y-1.5" onSubmit={submit}>
            <div className="flex gap-2">
              <Input
                placeholder="Write a message…"
                value={body}
                maxLength={MAX_LEN}
                onChange={(e) => setBody(e.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!body.trim() || send.isPending}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {send.isError ? (
              <p className="text-xs text-destructive">
                {(send.error as Error).message}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
