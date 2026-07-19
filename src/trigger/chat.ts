import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { ask } from "../core/ask";

const SYSTEM = [
  "You are Standing Questions, an agent over the live Bluesky firehose stored in ClickHouse.",
  "For ANY question about the data (volumes, trends, languages, likes, follows, posts, time ranges), you MUST call the askFirehose tool with the user's question. Never answer a data question from memory and never write SQL yourself; the tool compiles the question through a fail-closed SQL gate and returns a living chart card that the UI renders.",
  "After the tool returns, reply with at most ONE short sentence. The chart is the answer; text is garnish. If the tool declined or failed, briefly say why in plain words.",
  "If the user asks to keep watching a question, tell them to press Pin on the card; the agent re-evaluates pinned questions on a schedule and reopens this thread when a rule fires.",
  "Never use em dashes or en dashes.",
].join(" ");

const askFirehose = tool({
  description:
    "Answer a natural-language question about the live Bluesky firehose. Compiles the question into gated ClickHouse SQL (single SELECT, allowlisted tables, LIMIT required), executes it, and returns a living answer card (chart series, verdict, evidence) or a typed failure.",
  inputSchema: z.object({
    question: z.string().min(3).max(300).describe("The user's question, verbatim"),
  }),
  execute: async ({ question }) => await ask(question),
});

/**
 * The required Trigger.dev chat.agent() surface: every user turn runs as a
 * durable Trigger run. The agent itself is a thin conversational shell; the
 * data path stays inside askFirehose -> ask() (compile -> sqlAllowed gate ->
 * evaluatePlan), so the model never touches ClickHouse directly.
 */
export const sqChat = chat.agent({
  id: "sq-chat",
  machine: "small-1x",
  maxDuration: 300,
  run: async ({ messages, signal }) =>
    streamText({
      model: anthropic("claude-sonnet-5"),
      system: SYSTEM,
      messages,
      tools: { askFirehose },
      stopWhen: stepCountIs(3),
      abortSignal: signal,
    }),
});
