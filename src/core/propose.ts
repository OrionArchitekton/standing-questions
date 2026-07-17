import Anthropic from "@anthropic-ai/sdk";
import type { Proposer } from "./compile";

export function makeAnthropicProposer(
  apiKey: string,
  model = "claude-sonnet-5",
): Proposer {
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 25_000 });
  return async (prompt: string): Promise<string> => {
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  };
}
