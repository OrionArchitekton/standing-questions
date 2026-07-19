import type { LivingCard } from "@/core/card";
import type { ChartPlan } from "@/core/plan";
import type { DeltaRule } from "@/core/types";
import { ChartSvg } from "./ChartSvg";
import { PinButton } from "./PinButton";

function describeRule(rule: DeltaRule): string {
  if (rule.kind === "threshold") {
    const parts: string[] = [];
    if (rule.crossesAbove !== undefined) parts.push(`crosses above ${rule.crossesAbove}`);
    if (rule.crossesBelow !== undefined) parts.push(`crosses below ${rule.crossesBelow}`);
    return `Re-open this question when the latest value ${parts.join(" or ") || "crosses a threshold"}.`;
  }
  return `Re-open this question when the ${rule.window}-point windowed mean shifts by ${rule.minRatio}x.`;
}

export function LivingAnswerCard({
  card,
  question,
  plan,
  chatId,
}: {
  card: LivingCard;
  question?: string;
  plan?: ChartPlan;
  chatId?: string;
}) {
  return (
    <article
      data-testid="living-answer-card"
      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg"
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-100">{card.chart.title}</h2>
        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">
          living answer
        </span>
      </header>

      <ChartSvg type={card.chart.type} series={card.snapshot.series} />

      <p data-testid="verdict" className="mt-3 text-sm font-medium text-zinc-200">
        {card.verdict}
      </p>

      {question && plan && (
        <div className="mt-3">
          <PinButton question={question} plan={plan} card={card} chatId={chatId} />
        </div>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer select-none text-xs text-zinc-500 hover:text-zinc-300">
          Evidence: how this answer was computed
        </summary>
        <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
          <div>
            <div className="mb-1 font-medium text-zinc-400">Gated SQL (read-only, allowlisted)</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
              {card.sql}
            </pre>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-500">
            <span>
              Watch rule: <span className="text-zinc-300">{describeRule(card.deltaRule)}</span>
            </span>
            <span>
              Captured: <span className="text-zinc-300">{card.snapshot.capturedAt}</span>
            </span>
            <span>
              Points: <span className="text-zinc-300">{card.snapshot.series.length}</span>
            </span>
          </div>
        </div>
      </details>
    </article>
  );
}
