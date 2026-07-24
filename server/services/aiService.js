/**
 * aiService.js
 *
 * Provider-agnostic AI service. Swap providers via .env:
 *
 *   AI_PROVIDER=groq        → Groq API (free tier, fast)
 *   AI_PROVIDER=ollama      → Local Ollama (free, unlimited, needs GPU/CPU)
 *   AI_PROVIDER=anthropic   → Claude API (best quality, paid)
 *
 * All providers receive the same system + user prompt
 * and are expected to return a raw JSON string.
 */

require("dotenv").config();

const AI_PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();

// ─── Model defaults per provider ─────────────────────────────────────────────
const DEFAULT_MODELS = {
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
  anthropic: "claude-3-haiku-20240307",
};

// ─── Groq ─────────────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in .env");

  const model = process.env.AI_MODEL || DEFAULT_MODELS.groq;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.4,       // lower = more consistent JSON
      max_tokens: 2048,
      response_format: { type: "json_object" }, // Groq supports this
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Ollama ───────────────────────────────────────────────────────────────────
async function callOllama(systemPrompt, userPrompt) {
  const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const model   = process.env.AI_MODEL   || DEFAULT_MODELS.ollama;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      stream: false,
      options: { temperature: 0.4 },
      format: "json",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}. Is Ollama running?`);
  }

  const data = await response.json();
  return data.message.content;
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropic(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const model = process.env.AI_MODEL || DEFAULT_MODELS.anthropic;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
/**
 * Send a prompt to the configured AI provider.
 * Returns the raw response string (should be JSON).
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function callAI(systemPrompt, userPrompt) {
  console.log(`[ai] Using provider: ${AI_PROVIDER}`);

  switch (AI_PROVIDER) {
    case "groq":      return callGroq(systemPrompt, userPrompt);
    case "ollama":    return callOllama(systemPrompt, userPrompt);
    case "anthropic": return callAnthropic(systemPrompt, userPrompt);
    default:
      throw new Error(`Unknown AI_PROVIDER: "${AI_PROVIDER}". Use groq, ollama, or anthropic.`);
  }
}

/**
 * Parse and validate the raw AI response into a usable object.
 * Handles common issues like markdown fences, trailing commas.
 */
function parseAIResponse(raw) {
  // Strip markdown fences if the AI ignored instructions
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/```$/,  "").trim();
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    // Last resort: try to extract a JSON object
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error(`AI returned invalid JSON: ${e.message}\nRaw: ${clean.slice(0, 300)}`);
  }
}

module.exports = { callAI, parseAIResponse, AI_PROVIDER };