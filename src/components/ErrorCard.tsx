const REASON_LABELS: Record<string, string> = {
  refusal: "Declined",
  malformed: "Plan rejected",
  disallowed: "Safety gate",
  timeout: "Timed out",
  query_error: "Query failed",
  unreachable: "Data layer down",
  unconfigured: "Not configured",
  bad_request: "Bad request",
  network: "Network error",
  rate_limited: "Slow down",
  capacity: "At capacity",
};

export function ErrorCard({ reason, message }: { reason: string; message: string }) {
  return (
    <div
      data-testid="error-card"
      className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
          {REASON_LABELS[reason] ?? "Error"}
        </span>
        <span className="font-mono text-xs text-zinc-500">{reason}</span>
      </div>
      <p className="text-sm text-zinc-300">{message}</p>
      <p className="mt-2 text-xs text-zinc-500">
        Fail-closed by design: nothing runs unless the compiled plan passes the safety gate.
      </p>
    </div>
  );
}
