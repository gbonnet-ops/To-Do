/**
 * Shared helper for calling the Anthropic Claude API (Messages endpoint).
 * Replaces all direct OpenAI fetch calls across the codebase.
 */

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6-20250514";

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

/**
 * Call the Claude Messages API with a single user prompt.
 * Returns the text content of the first response block.
 * Throws on HTTP errors.
 */
export async function callClaude(
  prompt: string,
  opts: { maxTokens?: number; model?: string } = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      max_tokens: opts.maxTokens || 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: ClaudeResponse = await res.json();
  return data.content?.[0]?.text || "";
}
