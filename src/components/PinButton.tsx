"use client";

import { useState } from "react";
import type { LivingCard } from "@/core/card";
import type { ChartPlan } from "@/core/plan";

type PinState = "idle" | "pinning" | "pinned" | "failed";

export function PinButton({
  question,
  plan,
  card,
}: {
  question: string;
  plan: ChartPlan;
  card: LivingCard;
}) {
  const [state, setState] = useState<PinState>("idle");

  async function pin() {
    if (state === "pinning" || state === "pinned") return;
    setState("pinning");
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, plan, baseline: card.snapshot }),
      });
      setState(res.ok ? "pinned" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "pinned") {
    return (
      <span
        data-testid="pinned-badge"
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300"
      >
        <span aria-hidden>&#9733;</span> Standing: the agent re-checks every 10 minutes and
        reopens this thread on a material change
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="pin-button"
      onClick={() => void pin()}
      disabled={state === "pinning"}
      className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-sky-500/50 hover:text-sky-300 disabled:opacity-50"
    >
      {state === "pinning"
        ? "Pinning..."
        : state === "failed"
          ? "Pin failed, tap to retry"
          : "Pin as a Standing Question"}
    </button>
  );
}
