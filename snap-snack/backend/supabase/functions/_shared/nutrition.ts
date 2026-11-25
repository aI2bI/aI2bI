// Shared by the `ai` server function and the model-comparison test, so both use the exact same prompt and output shape.
import Anthropic from "@anthropic-ai/sdk";

export const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;
export type Model = (typeof MODELS)[number];

// USD per million tokens (input, output). Haiku 5.5's price is for prompts up to 100K tokens; ours are far smaller.
const PRICES: Record<Model, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
export const costUsd = (model: Model, input: number, output: number) =>
  (input * PRICES[model][0] + output * PRICES[model][1]) / 1_000_000;

export const VISION_PROMPT = `You are the nutrition engine of a food-photo logging app.
Look at the attached photo. Identify every distinct food and drink item: sides, sauces, dressings, drinks and toppings count separately when they add calories.
Estimate realistic portion sizes from visual cues (a dinner plate is about 10-11 in, a fork about 7 in, a can is 12 fl oz). If a nutrition label or menu is visible, use it.
Give nutrition for the portion shown, in grams for macros, saturated fat, fiber and sugar, milligrams for sodium, and kcal for calories.
If there is no food or drink in the photo, return no items and say what you see in the note.`;

const NUM = { type: "number" } as const;
export const ITEMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "items", "note"],
  properties: {
    title: { type: "string" },
    note: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "cal", "protein", "carbs", "fat", "sat_fat", "fiber", "sugar", "sodium", "confidence"],
        properties: {
          name: { type: "string" }, portion: { type: "string" },
          cal: NUM, protein: NUM, carbs: NUM, fat: NUM, sat_fat: NUM, fiber: NUM, sugar: NUM, sodium: NUM, confidence: NUM,
        },
      },
    },
  },
} as const;

export type Item = {
  name: string; portion: string; cal: number; protein: number; carbs: number; fat: number;
  sat_fat: number; fiber: number; sugar: number; sodium: number; confidence: number;
};
export type Analysis = { title: string; note: string; items: Item[] };

export class RefusedError extends Error {}

/** One photo → itemized nutrition. Returns the parsed result plus token usage for cost tracking. */
export async function analyzePhoto(
  client: Anthropic, model: Model, imageBase64: string, mediaType: "image/jpeg" | "image/png" | "image/webp",
) {
  const t0 = Date.now();
  // Server-side refusal fallback is on for Opus and Sonnet (opt-in beta); Haiku 5.5 has none.
  const fallback = model === "claude-haiku-5-5" ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const response = await client.beta.messages.create({
    model,
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ITEMS_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: VISION_PROMPT },
      ],
    }],
    ...fallback,
  });
  if (response.stop_reason === "refusal") throw new RefusedError("The photo could not be analyzed.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const result = JSON.parse(text) as Analysis;
  return {
    result,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    ms: Date.now() - t0,
  };
}
