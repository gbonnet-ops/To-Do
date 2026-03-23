/**
 * Shared helper for calling the Anthropic Claude API (Messages endpoint).
 * Supports system prompts with prompt caching and model selection.
 */

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

/**
 * Call the Claude Messages API.
 * - system: static instructions (cached via prompt caching for cost savings)
 * - prompt: dynamic user content (not cached)
 */
export async function callClaude(
  prompt: string,
  opts: { maxTokens?: number; model?: string; system?: string } = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Build request body
  const body: Record<string, unknown> = {
    model: opts.model || DEFAULT_MODEL,
    max_tokens: opts.maxTokens || 1024,
    messages: [{ role: "user", content: prompt }],
  };

  // System prompt with cache_control for prompt caching
  if (opts.system) {
    body.system = [
      {
        type: "text",
        text: opts.system,
        cache_control: { type: "ephemeral" },
      },
    ];
  }

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: ClaudeResponse = await res.json();
  return data.content?.[0]?.text || "";
}
