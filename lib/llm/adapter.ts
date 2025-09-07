import { HAS_OPENAI, OPENAI_MODE, OPENAI_BASE_URL, OPENAI_MODEL_OPTIMIZE, OPENAI_MODEL_TRANSLATE } from '@/lib/env';
import { getOpenAIConfig } from '@/lib/openai-config';

/**
 * Get current LLM mode and availability
 */
export function getLlmmode() {
  const useLive = HAS_OPENAI && OPENAI_MODE === 'live';
  return { useLive, hasKey: HAS_OPENAI, mode: useLive ? 'live' as const : 'stub' as const };
}

/**
 * Input for optimization tasks
 */
export interface OptimizeInput {
  nameSv: string;
  descriptionSv: string;
  attributes?: string | object | null;
  toneHint?: string;
}

/**
 * Input for translation tasks
 */
export interface TranslateInput {
  text: string;
  target: 'da' | 'no';
}

/**
 * Retry configuration for network requests
 */
const RETRY_CONFIG = {
  tries: 3,
  baseMs: 400
} as const;

/**
 * Timeout for OpenAI requests (45 seconds)
 */
const REQUEST_TIMEOUT_MS = 45000;

/**
 * Retry fetch with exponential backoff and jitter
 */
async function retryFetch(
  url: string, 
  options: RequestInit, 
  { tries, baseMs }: typeof RETRY_CONFIG
): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === tries - 1) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseMs * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Optimize Swedish product text using live OpenAI or stub
 */
export async function optimizeSv(input: OptimizeInput, options?: {
  system?: string;
  headers?: string;
  maxWords?: number;
  temperature?: number;
  model?: string;
  toneDefault?: string;
}): Promise<string> {
  const { useLive, mode } = getLlmmode();
  
  // Log mode before call
  console.debug(`[LLM] Starting optimization with mode: ${mode}`);
  
  // Use live OpenAI if available and mode is live
  if (useLive) {
    try {
      // Get configuration from settings or ENV fallback
      const config = await getOpenAIConfig();
      const targetModel = options?.model || config.model;
      
      console.debug(`[LLM] Using model: ${targetModel}`);
      
      const systemPrompt = options?.system || config.promptOptimizeSv;

      const userPrompt = `Skriv om denna produkt enligt rubrikerna nedan. Kort, tydligt språk. Inkludera viktiga sökord. Bevara varumärken exakt.

Originalnamn: ${input.nameSv}
Originalbeskrivning: ${input.descriptionSv}
Attribut (frivilligt): ${input.attributes ? JSON.stringify(input.attributes) : 'Inga attribut'}
Ton: ${input.toneHint || 'professionell'}

Rubriker och format (klistra in precis så här i svaret):

Titel (SEO/UX-optimerad)
{{din titel här}}

Kort introduktion
{{din korta intro, 1–2 meningar}}

Produktbeskrivning
{{3–5 korta meningar med vad man gör, upplever, får}}

Höjdpunkter (för UX, CRO och AI Overview)
{{punkt 1, fakta/nytta}}
{{punkt 2, fakta/nytta}}
{{punkt 3, fakta/nytta}}
{{punkt 4, fakta/nytta}}
{{punkt 5, fakta/nytta}}

Meta (valfritt)
Meta Title: {{≤ 60 tecken}}
Meta Description: {{≤ 155 tecken, inkl CTA}}

Regler: inga emojis, inga garantier/lagtext, inga påhittade features.`;

      const response = await retryFetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: options?.temperature || 0.2,
          max_tokens: 900
        })
      }, RETRY_CONFIG);

      const data = await response.json();
      console.debug(`[LLM] Optimization completed successfully with mode: ${mode}`);
      return data.choices[0].message.content;
      
    } catch (error) {
      console.error('OpenAI optimize error:', error);
      console.debug(`[LLM] Optimization failed with mode: ${mode}, falling back to stub`);
      // Fall back to stub on error
    }
  }
  
  // Stub implementation (matches new prompt structure)
  const snippet = input.descriptionSv
    .substring(0, 240)
    .trim();
  
  let attributesSection = '';
  if (input.attributes) {
    try {
      const parsed = JSON.parse(input.attributes as string);
      if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed)) {
          attributesSection = parsed.join(', ');
        } else {
          attributesSection = Object.entries(parsed)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        }
      } else {
        attributesSection = input.attributes as string;
      }
    } catch {
      attributesSection = input.attributes as string;
    }
  }

  const result = `Titel (SEO/UX-optimerad)
${input.nameSv} - Professionell lösning

Kort introduktion
${snippet}

Produktbeskrivning
Denna produkt erbjuder pålitlig funktionalitet för dina behov. Med sin kvalitetsbyggnad och användarvänliga design ger den dig en smidig upplevelse. Perfekt för både professionellt och privat bruk.

Höjdpunkter (för UX, CRO och AI Overview)
- Hög kvalitet och pålitlighet
- Användarvänlig design och funktionalitet
- Mångsidig användning
- Kostnadseffektiv lösning
- Snabb leverans och support

Meta (valfritt)
Meta Title: ${input.nameSv} - Professionell lösning för dina behov
Meta Description: Upptäck ${input.nameSv} - en pålitlig och användarvänlig produkt som ger dig kvalitet och funktionalitet. Beställ nu för snabb leverans!`;

  console.debug(`[LLM] Stub optimization completed successfully with mode: ${mode}`);
  return result;
}

/**
 * Translate text to Danish or Norwegian using live OpenAI or stub
 */
export async function translateTo(input: TranslateInput): Promise<string> {
  // Use live OpenAI if available and mode is live
  if (HAS_OPENAI && OPENAI_MODE === 'live') {
    try {
      // Get configuration from settings or ENV fallback
      const config = await getOpenAIConfig();
      const targetLang = input.target === 'da' ? 'danska' : 'norska';
      
      const systemPrompt = config.promptTranslateDirect.replace('{targetLang}', targetLang);

      const userPrompt = `Översätt svenska → ${targetLang} verbatim. Behåll exakt struktur/HTML/markdown. Lägg inte till rubriker eller '#'-tecken. Bevara alla taggar, klamrar {{...}}, listor, radbrytningar och ordning. Översätt endast textnoder:

${input.text}`;

      const response = await retryFetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0,
          max_tokens: 900
        })
      }, RETRY_CONFIG);

      const data = await response.json();
      return data.choices[0].message.content;
      
    } catch (error) {
      console.error('OpenAI translate error:', error);
      // Fall back to stub on error
    }
  }
  
  // Stub implementation (preserves exact structure from tests)
  // Add small delay to simulate real API call
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  const langCode = input.target.toUpperCase();
  const langSuffix = input.target === 'da' ? ' [DA]' : ' [NO]';
  
  // Add meta line at top
  let translated = `<!-- lang:${langCode} -->\n`;
  
  // Process line by line to preserve structure
  const lines = input.text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (i === 0 && line.startsWith('# ')) {
      // Add language suffix to H1 only
      translated += line + langSuffix + '\n';
    } else {
      // Keep all other lines verbatim (including ## headings)
      translated += line + '\n';
    }
  }
  
  return translated.trim();
}

// TODO: Rate limit policy implementation
// TODO: Token usage logging
// TODO: Prompt versioning system
// TODO: Structured attributes in "Specifikationer" section
