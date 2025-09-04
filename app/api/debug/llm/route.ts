import { NextRequest, NextResponse } from 'next/server';
import { optimizeSv } from '@/lib/llm/adapter';
import { getLlmmode } from '@/lib/llm/adapter';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { text, nameSv, attributes, options } = body;

    // Build tiny OptimizeInput
    const input = {
      nameSv: nameSv ?? "Demo Produkt",
      descriptionSv: text ?? "Detta är en demo–beskrivning för diagnostik.",
      attributes: attributes ?? "färg: blå; vikt: 1kg",
      toneHint: undefined
    };

    // Get LLM mode info
    const { useLive, hasKey, mode } = getLlmmode();

    // Call existing optimizeSv(input, options)
    const result = await optimizeSv(input, options);

    // Response JSON
    const response = {
      mode: useLive ? "live" : "stub",
      hasKey,
      model: useLive ? process.env.OPENAI_MODEL_OPTIMIZE || 'gpt-4o-mini' : "stub",
      preview: result.substring(0, 200)
    };

    return NextResponse.json(response);
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: "LLM error", detail: safeMessage },
      { status: 500 }
    );
  }
}
