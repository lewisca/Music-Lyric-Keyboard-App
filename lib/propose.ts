// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 — PROPOSE
// ─────────────────────────────────────────────────────────────────────────────
// The user's raw feeling goes to Claude, which proposes 1–3 songs whose MEANING
// fits the feeling (a semantic match, not a keyword match). The selected genre is
// passed in to NARROW the candidate space *before* the model proposes — it is a
// constraint on matching, not a post-hoc filter on results.
//
// The model returns STRICT JSON only. We treat every proposal as a HYPOTHESIS:
// nothing here is trusted until STAGE 2 (resolve) proves the song is real.
//
// Runs SERVER-SIDE only. The Anthropic key is read from the environment and never
// reaches the client.

import Anthropic from "@anthropic-ai/sdk";
import { demoPropose } from "./demo";
import type { Genre, Proposal } from "./types";

// Haiku 4.5 is fast and cheap — plenty for a 1–3 song JSON proposal.
const MODEL = "claude-haiku-4-5";

function systemPrompt(genre: Genre): string {
  return [
    `You are the matching engine for "Unsaid", a tool that helps someone finish an`,
    `unspoken feeling by pointing them to a song that already captured it.`,
    ``,
    `The user gives you a raw, half-formed feeling. Propose 1 to 3 real, well-known`,
    `songs whose MEANING matches that feeling — a semantic/emotional match, not a`,
    `keyword match. Do not pick a song just because it shares a word with the input.`,
    ``,
    `Constraint: every proposal MUST fit the genre "${genre}". The genre narrows the`,
    `space you choose from; the same feeling in a different genre should yield a`,
    `different song. Prefer real, verifiable songs by the correct artist.`,
    ``,
    `For each proposal, write ONE original sentence for "why_it_fits" that names the`,
    `emotional bridge between the user's feeling and the song. This sentence is what`,
    `the user actually reads — make it specific and human. Do NOT quote lyrics.`,
    ``,
    `Order proposals best-fit first.`,
    ``,
    `Respond with STRICT JSON ONLY — no prose, no markdown, no code fences. The exact`,
    `shape is a JSON array:`,
    `[{ "song": "...", "artist": "...", "why_it_fits": "..." }]`,
  ].join("\n");
}

/**
 * Pull a JSON array out of the model's text. We instruct strict JSON, but parse
 * defensively — strip any stray code fence, and fall back to the first bracketed
 * span — so a small formatting slip doesn't crash the loop.
 */
function parseProposals(raw: string): Proposal[] {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const attempts = [cleaned];
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) attempts.push(cleaned.slice(start, end + 1));

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed as Proposal[];
    } catch {
      // try the next candidate
    }
  }
  return [];
}

/**
 * Ask Claude for candidate songs. Returns an ordered list of unverified proposals
 * (best fit first). Returns `[]` on any failure so the caller can degrade gracefully.
 */
export async function propose(feeling: string, genre: Genre): Promise<Proposal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // DEMO MODE: no key, so stand in for the model with the keyless demo proposer.
    // Same downstream loop — resolve/verify still confirm these are real songs.
    console.warn("[propose] ANTHROPIC_API_KEY unset — using keyless demo proposer");
    return demoPropose(feeling, genre);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(genre),
      messages: [{ role: "user", content: feeling }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];

    return parseProposals(textBlock.text).slice(0, 3);
  } catch (err) {
    console.error("[propose] model call failed:", err);
    return [];
  }
}
