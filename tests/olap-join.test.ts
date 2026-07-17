import { describe, expect, it } from "vitest";
import { mapWatchRows } from "../src/core/olap-join";

describe("mapWatchRows (CDC join row mapping)", () => {
  it("coerces ClickHouse string counts to numbers", () => {
    const rows = mapWatchRows([
      { id: "a", question: "q", since: "2026-07-17 21:59:10", events_since: "52473" },
    ]);
    expect(rows).toEqual([
      { id: "a", question: "q", since: "2026-07-17 21:59:10", eventsSince: 52473 },
    ]);
  });

  it("drops rows whose count does not parse", () => {
    const rows = mapWatchRows([
      { id: "a", question: "q", since: "s", events_since: "not-a-number" },
      { id: "b", question: "q2", since: "s", events_since: 7 },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });
});
