import { describe, expect, it } from "vitest";
import { jetstreamEventToRow } from "../src/core/jetstream";

const postEvent = {
  did: "did:plc:abc123",
  time_us: 1784541600000000, // 2026-07-20 10:00:00 UTC
  kind: "commit",
  commit: {
    operation: "create",
    collection: "app.bsky.feed.post",
    rkey: "3kx",
    record: {
      $type: "app.bsky.feed.post",
      text: "hello world",
      langs: ["en", "pt"],
    },
  },
};

describe("jetstreamEventToRow (pure ingest mapping seam)", () => {
  it("maps a post commit to a full row with first lang and text length", () => {
    const row = jetstreamEventToRow(postEvent);
    expect(row).toEqual({
      ts: "2026-07-20 10:00:00",
      kind: "commit",
      collection: "app.bsky.feed.post",
      operation: "create",
      lang: "en",
      did: "did:plc:abc123",
      text_len: 11,
    });
  });

  it("maps a like commit with empty lang and zero text_len", () => {
    const row = jetstreamEventToRow({
      did: "did:plc:xyz",
      time_us: 1784541600000000,
      kind: "commit",
      commit: { operation: "create", collection: "app.bsky.feed.like", record: {} },
    });
    expect(row).toMatchObject({ collection: "app.bsky.feed.like", lang: "", text_len: 0 });
  });

  it("maps identity events with empty collection/operation", () => {
    const row = jetstreamEventToRow({
      did: "did:plc:idn",
      time_us: 1784541600000000,
      kind: "identity",
    });
    expect(row).toMatchObject({ kind: "identity", collection: "", operation: "", text_len: 0 });
  });

  it("maps delete commits (no record) safely", () => {
    const row = jetstreamEventToRow({
      did: "did:plc:del",
      time_us: 1784541600000000,
      kind: "commit",
      commit: { operation: "delete", collection: "app.bsky.feed.post" },
    });
    expect(row).toMatchObject({ operation: "delete", lang: "", text_len: 0 });
  });

  it("clamps text_len to UInt16 and rejects malformed events with null", () => {
    const long = jetstreamEventToRow({
      ...postEvent,
      commit: { ...postEvent.commit, record: { text: "x".repeat(70_000), langs: [] } },
    });
    expect(long?.text_len).toBe(65_535);
    expect(jetstreamEventToRow({} as never)).toBeNull();
    expect(jetstreamEventToRow({ did: "d", kind: "commit" } as never)).toBeNull();
  });
});
