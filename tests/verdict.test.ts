import { describe, expect, it } from "vitest";
import { renderVerdict } from "../src/core/verdict";

describe("renderVerdict (spec: verdict is one line, stat interpolated)", () => {
  it("interpolates {stat} with locale-formatted numbers", () => {
    expect(renderVerdict("Last hour: {stat} posts", 12345)).toBe("Last hour: 12,345 posts");
  });

  it("interpolates every occurrence", () => {
    expect(renderVerdict("{stat} now, was {stat}", 7)).toBe("7 now, was 7");
  });

  it("collapses newlines: a verdict is one line by contract", () => {
    expect(renderVerdict("top\nbottom {stat}", 1)).toBe("top bottom 1");
  });

  it("strips long dashes defensively even if the model slipped one through", () => {
    expect(renderVerdict("posts — up {stat}", 2)).toBe("posts - up 2");
  });
});
