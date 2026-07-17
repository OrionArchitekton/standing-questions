import type { Metadata } from "next";
import { AskForm } from "@/components/AskForm";
import { ErrorCard } from "@/components/ErrorCard";
import { LivingAnswerCard } from "@/components/LivingAnswerCard";
import { ToldFeed } from "@/components/ToldFeed";
import { ask } from "@/core/ask";
import { listRecentTold, type ToldLedgerRow } from "@/core/db";

export const metadata: Metadata = {
  title: "Standing Questions",
  description:
    "Ask the Bluesky firehose once, get a living chart. The agent keeps watching and reopens the thread when the picture changes.",
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
  const demoResult = demoQuestion ? await ask(demoQuestion) : null;

  let told: ToldLedgerRow[] = [];
  try {
    told = await listRecentTold(6);
  } catch {
    // told feed is progressive enhancement; the page renders without it
  }

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
            thread with a visual delta, not a wall of text.
          </p>
        </header>

        <AskForm initialQuestion={demoQuestion ?? ""} />

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

        <ToldFeed rows={told} />

        <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-8 text-xs text-zinc-600">
          <span>ClickHouse and Trigger.dev Summer Hackathon 2026</span>
          <a
            href="https://github.com/OrionArchitekton/standing-questions"
            className="underline-offset-2 hover:text-zinc-400 hover:underline"
          >
            source
          </a>
          <span>read-only demo; questions are compiled through a fail-closed SQL gate</span>
        </footer>
      </main>
    </div>
  );
}
