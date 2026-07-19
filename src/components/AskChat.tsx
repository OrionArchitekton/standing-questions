"use client";

import { useChat } from "@ai-sdk/react";
import { TriggerChatTransport } from "@trigger.dev/sdk/chat";
import { useMemo, useState } from "react";
import type { AskResult } from "@/core/card";
import { ErrorCard } from "./ErrorCard";
import { LivingAnswerCard } from "./LivingAnswerCard";

const EXAMPLES = [
  "How many posts per hour in the last 24 hours?",
  "Which languages dominate the firehose today?",
  "Are posts getting longer or shorter this week?",
];

async function fetchSessionToken(chatId: string, mode: "start" | "refresh"): Promise<string> {
  const res = await fetch("/api/chat/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chatId, mode }),
  });
  if (!res.ok) throw new Error(`session ${mode} failed: ${res.status}`);
  const body = (await res.json()) as { publicAccessToken?: string };
  if (!body.publicAccessToken) throw new Error("session response missing token");
  return body.publicAccessToken;
}

/** Narrow an askFirehose tool output to the AskResult shape the cards render. */
function asAskResult(output: unknown): AskResult | null {
  if (!output || typeof output !== "object" || !("ok" in output)) return null;
  return output as AskResult;
}

export function AskChat() {
  const [chatId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new TriggerChatTransport({
        task: "sq-chat",
        startSession: async ({ chatId: id }) => ({
          publicAccessToken: await fetchSessionToken(id, "start"),
        }),
        accessToken: ({ chatId: id }) => fetchSessionToken(id, "refresh"),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({ id: chatId, transport });
  const busy = status === "submitted" || status === "streaming";

  function submit(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3 || busy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }

  // The question a tool answer belongs to = the latest user text at or before
  // that message (pure lookup; render must not mutate).
  function userTextBefore(index: number): string {
    for (let j = index; j >= 0; j--) {
      const m = messages[j];
      if (m.role !== "user") continue;
      const textPart = m.parts.find((p) => p.type === "text");
      if (textPart && "text" in textPart) return textPart.text;
    }
    return "";
  }

  return (
    <div className="flex w-full flex-col gap-4" data-testid="ask-chat">
      <form
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          type="text"
          name="question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          placeholder="Ask the firehose a question..."
          aria-label="Your question"
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500/60"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Thinking..." : "Ask"}
        </button>
      </form>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-emerald-500/50 hover:text-zinc-200"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((message, mi) => (
          <div key={message.id} className="flex flex-col gap-3">
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                if (message.role === "user") {
                  return (
                    <p
                      key={i}
                      className="self-end rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200"
                    >
                      {part.text}
                    </p>
                  );
                }
                return part.text.trim() ? (
                  <p key={i} className="text-sm leading-6 text-zinc-400">
                    {part.text}
                  </p>
                ) : null;
              }
              if (part.type === "tool-askFirehose") {
                if (part.state === "output-available") {
                  const result = asAskResult(part.output);
                  if (!result) return null;
                  return result.ok ? (
                    <LivingAnswerCard
                      key={i}
                      card={result.card}
                      question={userTextBefore(mi) || undefined}
                      plan={result.plan}
                      chatId={chatId}
                    />
                  ) : (
                    <ErrorCard key={i} reason={result.reason} message={result.message} />
                  );
                }
                return (
                  <div
                    key={i}
                    data-testid="loading-card"
                    className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                  >
                    <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
                    <div className="h-40 animate-pulse rounded-lg bg-zinc-800/60" />
                    <p className="text-xs text-zinc-500">
                      The agent is compiling your question into a gated query and running it live...
                    </p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      {status === "error" && (
        <ErrorCard
          reason="network"
          message="The agent run could not be reached. Retry in a moment."
        />
      )}
    </div>
  );
}
