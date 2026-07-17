export type BlueskyEventRow = {
  ts: string;
  kind: string;
  collection: string;
  operation: string;
  lang: string;
  did: string;
  text_len: number;
};

type JetstreamEvent = {
  did?: unknown;
  time_us?: unknown;
  kind?: unknown;
  commit?: {
    operation?: unknown;
    collection?: unknown;
    record?: { text?: unknown; langs?: unknown };
  };
};

const KINDS = new Set(["commit", "identity", "account"]);
const UINT16_MAX = 65_535;

/** Format epoch milliseconds as a ClickHouse DateTime string (UTC). */
export function formatChTs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

export function jetstreamEventToRow(event: JetstreamEvent): BlueskyEventRow | null {
  if (typeof event?.did !== "string" || typeof event.time_us !== "number") return null;
  if (typeof event.kind !== "string" || !KINDS.has(event.kind)) return null;

  const commit = event.kind === "commit" ? event.commit : undefined;
  const record = commit?.record;
  const langs = Array.isArray(record?.langs) ? record.langs : [];
  const text = typeof record?.text === "string" ? record.text : "";

  return {
    ts: formatChTs(event.time_us / 1_000),
    kind: event.kind,
    collection: typeof commit?.collection === "string" ? commit.collection : "",
    operation: typeof commit?.operation === "string" ? commit.operation : "",
    lang: typeof langs[0] === "string" ? langs[0] : "",
    did: event.did,
    text_len: Math.min(text.length, UINT16_MAX),
  };
}
