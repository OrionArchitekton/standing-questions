import type { Metadata } from "next";
import { headers } from "next/headers";
import { AskChat } from "@/components/AskChat";
import { ErrorCard } from "@/components/ErrorCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { LivingAnswerCard } from "@/components/LivingAnswerCard";
import { StandingWatch } from "@/components/StandingWatch";
import { ToldFeed } from "@/components/ToldFeed";
import { ask } from "@/core/ask";
import { listRecentTold, type ToldLedgerRow } from "@/core/db";
import { sinceLastTold, type WatchRow } from "@/core/olap-join";
import { makeRateLimiter } from "@/core/rate-limit";

// The SSR ?demo= path runs a real ask() (a model call) outside /api/ask, so it
// carries its own per-IP limiter; without one, page loads bypass the API gate.
const allowDemo = makeRateLimiter({ limit: 5, windowMs: 60_000 });

export const metadata: Metadata = {
  title: "Standing Questions",
  description:
    "Ask the Bluesky firehose once, get a living chart. The agent keeps watching and reopens the question when the picture changes.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const demoRaw = params.demo;
  const demoQuestion =
    typeof demoRaw === "string" && demoRaw.trim().length >= 3 ? demoRaw.trim().slice(0, 300) : null;
  let demoResult = null;
  if (demoQuestion) {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    demoResult = allowDemo(ip)
      ? await ask(demoQuestion)
      : ({
          ok: false as const,
          reason: "rate_limited",
          message: "Too many demo renders; wait a minute.",
          status: 429,
        } as const);
  }

  let told: ToldLedgerRow[] = [];
  try {
    told = await listRecentTold(6);
  } catch {
    // told feed is progressive enhancement; the page renders without it
  }
  const watch: WatchRow[] = await sinceLastTold();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-950 font-sans">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-xs uppercase tracking-widest text-zinc-500">
              live on the Bluesky firehose
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Standing Questions
          </h1>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Ask once, get a living chart instead of a paragraph. Pin it, and the agent keeps
            re-evaluating on Trigger.dev; when the picture materially changes, it reopens the
            question with a visual before/after delta, not a wall of text.
          </p>
        </header>

        <AskChat />

        {demoResult &&
          (demoResult.ok ? (
            <section aria-label="demo answer">
              <p className="mb-2 text-xs uppercase tracking-widest text-zinc-600">
                server-rendered demo answer
              </p>
              <LivingAnswerCard
                card={demoResult.card}
                question={demoQuestion ?? undefined}
                plan={demoResult.plan}
              />
            </section>
          ) : (
            <section aria-label="demo answer">
              <p className="mb-2 text-xs uppercase tracking-widest text-zinc-600">
                server-rendered demo answer
              </p>
              <ErrorCard reason={demoResult.reason} message={demoResult.message} />
            </section>
          ))}

        <StandingWatch rows={watch} />
        <ToldFeed rows={told} />
        <LiveRefresh />

        <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-8 text-xs text-zinc-600">
          <span>ClickHouse and Trigger.dev Summer Hackathon 2026</span>
          <a
            href="https://github.com/OrionArchitekton/standing-questions"
            className="underline-offset-2 hover:text-zinc-400 hover:underline"
          >
            source
          </a>
          <span>read-only demo; questions are compiled through a fail-closed SQL gate</span>
          <span>sampled stream: a bounded 25s Jetstream capture every 5 minutes, not the full firehose</span>
        </footer>
      </main>
    </div>
  );
}
