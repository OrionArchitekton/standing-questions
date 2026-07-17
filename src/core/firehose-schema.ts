import type { FirehoseSchema } from "./plan";

export const firehoseSchema: FirehoseSchema = {
  tables: [
    {
      name: "bluesky_events",
      columns: ["ts", "kind", "collection", "operation", "lang", "did", "text_len"],
      description:
        "One row per Bluesky Jetstream event. ts is a DateTime in UTC (compare with now(), today(), INTERVAL directly; no unix conversion needed); kind is commit/identity/account; collection is the record type (app.bsky.feed.post, app.bsky.feed.like, app.bsky.graph.follow, ...); operation is create/update/delete; lang is the first declared post language or empty; text_len is post text length in characters (0 for non-posts).",
    },
    {
      name: "sq_ticks",
      columns: ["ts", "standing_question_id", "outcome", "eval_ms"],
      description:
        "Self-telemetry: one row per standing-question evaluation; outcome is silent/delta/error.",
    },
  ],
};
