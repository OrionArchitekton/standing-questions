"use client";

import { useState } from "react";
import type { LivingCard } from "@/core/card";
import type { ChartPlan } from "@/core/plan";
import { ErrorCard } from "./ErrorCard";
import { LivingAnswerCard } from "./LivingAnswerCard";

const EXAMPLES = [
  "How many posts per hour in the last 24 hours?",
  "Which languages dominate the firehose today?",
  "Are posts getting longer or shorter this week?",
];

type AskState =
  | { phase: "idle" }
  | { phase: "loading"; question: string }
  | { phase: "answered"; card: LivingCard; plan?: ChartPlan; question: string }
  | { phase: "failed"; reason: string; message: string };

export function AskForm({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [state, setState] = useState<AskState>({ phase: "idle" });

  async function submit(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3 || state.phase === "loading") return;
    setState({ phase: "loading", question: trimmed });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await res.json();
      if (body.ok) {
        setState({ phase: "answered", card: body.card, plan: body.plan, question: trimmed });
      } else {
        setState({
          phase: "failed",
          reason: body.reason ?? "unreachable",
          message: body.message ?? "Something went wrong. Nothing was executed.",
        });
      }
    } catch {
      setState({
        phase: "failed",
        reason: "network",
        message: "Could not reach the agent. Check your connection and retry.",
      });
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <form
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
      >
        <input
          type="text"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="Ask the firehose a question..."
          aria-label="Your question"
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500/60"
        />
        <button
          type="submit"
          disabled={state.phase === "loading"}
          className="shrink-0 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.phase === "loading" ? "Thinking..." : "Ask"}
        </button>
      </form>

      {state.phase === "idle" && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuestion(ex);
                void submit(ex);
              }}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-emerald-500/50 hover:text-zinc-200"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {state.phase === "loading" && (
        <div
          data-testid="loading-card"
          className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-40 animate-pulse rounded-lg bg-zinc-800/60" />
          <p className="text-xs text-zinc-500">
            Compiling your question into a gated query, then running it live...
          </p>
        </div>
      )}

      {state.phase === "answered" && (
        <LivingAnswerCard card={state.card} question={state.question} plan={state.plan} />
      )}
      {state.phase === "failed" && <ErrorCard reason={state.reason} message={state.message} />}
    </div>
  );
}
