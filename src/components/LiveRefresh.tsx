"use client";

import { useRealtimeRunsWithTag } from "@trigger.dev/react-hooks";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const FALLBACK_REFRESH_MS = 30_000;

function RealtimeWatcher({ token }: { token: string }) {
  const router = useRouter();
  const { runs } = useRealtimeRunsWithTag("sq", { accessToken: token });
  const lastCompleted = useRef<string | null>(null);

  useEffect(() => {
    const completed = runs.find((r) => r.status === "COMPLETED");
    if (completed && completed.id !== lastCompleted.current) {
      lastCompleted.current = completed.id;
      router.refresh(); // a sweep finished: re-render told feed from Neon
    }
  }, [runs, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
      live: watching agent sweeps over Trigger.dev Realtime
    </span>
  );
}

/**
 * Progressive live updates: Trigger.dev Realtime when a token is mintable,
 * otherwise a quiet timed refresh. Either way the told feed stays current.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"probing" | "realtime" | "fallback">("probing");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/realtime-token")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.ok && typeof body.token === "string") {
          setToken(body.token);
          setMode("realtime");
        } else {
          setMode("fallback");
        }
      })
      .catch(() => {
        if (!cancelled) setMode("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "fallback") return;
    const timer = setInterval(() => router.refresh(), FALLBACK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [mode, router]);

  if (mode === "realtime" && token) return <RealtimeWatcher token={token} />;
  return null;
}
