import { HAS_OPENAI, OPENAI_MODE, OPENAI_BASE_URL, OPENAI_MODEL_OPTIMIZE, OPENAI_MODEL_TRANSLATE } from '@/lib/env';
import { getOpenAIConfig } from '@/lib/openai-config';
import { createPromptBuilder, PromptContext } from '@/lib/prompt-builder';
import { buildGlossaryContext, applyGlossary } from '@/lib/glossary';

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
  rawData?: string | object; // Raw Excel data
}

/**
 * Input for brand optimization tasks
 */
export interface OptimizeBrandInput {
  nameSv: string;
  descriptionSv: string;
  attributes?: string | object | null;
  toneHint?: string;
  rawData?: string | object; // Raw Excel data
}

/**
 * Input for translation tasks
 */
export interface TranslateInput {
  text: string;
  target: string; // ISO-639-1 language code
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
  promptOptimizeSv?: string;
  uploadMeta?: string;
  settingsTokens?: string;
}): Promise<string> {
  const { useLive, mode } = getLlmmode();
  
  // Log mode before call
  console.debug(`[LLM] Starting optimization with mode: ${mode}`);
  
  // Use live OpenAI if available and mode is live
  if (useLive) {
    try {
      // Use passed configuration or get from settings as fallback
      const config = await getOpenAIConfig();
      if (options?.model) config.model = options.model;
      if (options?.promptOptimizeSv) config.promptOptimizeSv = options.promptOptimizeSv;
      
      const targetModel = options?.model || config.model;
      
      console.debug(`[LLM] Using model: ${targetModel}`);
      
      // Create prompt builder with token support
      const promptBuilder = createPromptBuilder(options?.uploadMeta, options?.settingsTokens);
      
      // Build product data for token replacement
      const productData: Record<string, string> = {
        name_sv: input.nameSv,
        title: input.nameSv, // alias
        description_sv: input.descriptionSv,
        sv_description: input.descriptionSv, // alias
        attributes: typeof input.attributes === 'string' ? input.attributes : (input.attributes ? JSON.stringify(input.attributes) : ''),
        tone_hint: input.toneHint || 'professionell'
      };

      // Add raw data from Excel if available
      if (input.rawData) {
        try {
          const rawData = typeof input.rawData === 'string' ? JSON.parse(input.rawData) : input.rawData;
          console.debug('[LLM] Raw data found:', Object.keys(rawData));
          // Add all raw data fields as tokens
          Object.entries(rawData).forEach(([key, value]) => {
            const normalizedKey = key.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
            productData[normalizedKey] = String(value || '');
            console.debug(`[LLM] Added token: ${normalizedKey} = ${String(value || '')}`);
          });
        } catch (error) {
          console.warn('Failed to parse raw data:', error);
        }
      } else {
        console.debug('[LLM] No raw data available, trying to extract from attributes');
        // Fallback: try to extract tokens from attributes field
        if (input.attributes) {
          const attributesStr = typeof input.attributes === 'string' ? input.attributes : JSON.stringify(input.attributes);
          // Parse attributes like "Brand: Logitech | Series: Minecraft | Age: 7+ | Pieces: 238"
          const attributePairs = attributesStr.split('|').map(pair => pair.trim());
          attributePairs.forEach(pair => {
            const [key, value] = pair.split(':').map(s => s.trim());
            if (key && value) {
              const normalizedKey = key.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
              productData[normalizedKey] = value;
              console.debug(`[LLM] Added token from attributes: ${normalizedKey} = ${value}`);
            }
          });
        }
      }

      // Build context for prompt
      const context: PromptContext = {
        jobType: 'product_texts',
        productData
      };

      // Use the user's custom prompt with token replacement
      console.debug('[LLM] Product data for tokens:', productData);
      const userPrompt = promptBuilder.buildPrompt(options?.system || config.promptOptimizeSv, context);
      console.debug('[LLM] Final prompt after token replacement:', userPrompt);

      // Use a simple system prompt that doesn't dictate structure
      const systemPrompt = `Du är en expert på att optimera produkttexter. Följ användarens instruktioner exakt.`;

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
 * Optimize Swedish brand text using live OpenAI or stub
 */
export async function optimizeBrand(input: OptimizeBrandInput, options?: {
  system?: string;
  headers?: string;
  maxWords?: number;
  temperature?: number;
  model?: string;
  toneDefault?: string;
  promptOptimizeBrandsSv?: string;
  uploadMeta?: string;
  settingsTokens?: string;
}): Promise<{ short_sv: string; long_html_sv: string }> {
  const { useLive, mode } = getLlmmode();
  
  // Log mode before call
  console.debug(`[LLM] Starting brand optimization with mode: ${mode}`);
  
  // Use live OpenAI if available and mode is live
  if (useLive) {
    try {
      // Use passed configuration or get from settings as fallback
      const config = await getOpenAIConfig();
      if (options?.model) config.model = options.model;
      if (options?.promptOptimizeSv) config.promptOptimizeSv = options.promptOptimizeSv;
      
      const targetModel = options?.model || config.model;
      
      console.debug(`[LLM] Using model: ${targetModel}`);
      
      // Create prompt builder with token support
      const promptBuilder = createPromptBuilder(options?.uploadMeta, options?.settingsTokens);
      
      // Build product data for token replacement
      const productData: Record<string, string> = {
        name_sv: input.nameSv,
        title: input.nameSv, // alias
        description_sv: input.descriptionSv,
        sv_description: input.descriptionSv, // alias
        attributes: typeof input.attributes === 'string' ? input.attributes : (input.attributes ? JSON.stringify(input.attributes) : ''),
        tone_hint: input.toneHint || 'professionell'
      };

      // Add raw data from Excel if available
      if (input.rawData) {
        try {
          const rawDataObj = typeof input.rawData === 'string' ? JSON.parse(input.rawData) : input.rawData;
          Object.entries(rawDataObj).forEach(([key, value]) => {
            if (key !== '__original_row_number__' && value !== null && value !== undefined) {
              productData[key] = String(value);
            }
          });
        } catch (error) {
          console.warn('Failed to parse raw data for brand optimization:', error);
        }
      }

      const context: PromptContext = {
        targetLang: 'sv',
        jobType: 'brands',
        productData
      };

      // Use the user's custom prompt with token replacement
      console.debug('[LLM] Brand data for tokens:', productData);
      const userPrompt = promptBuilder.buildPrompt(options?.system || config.promptOptimizeBrandsSv, context);
      console.debug('[LLM] Final brand prompt after token replacement:', userPrompt);

      // Use a simple system prompt that doesn't dictate structure
      const systemPrompt = `Du är en expert på att optimera varumärkestexter. Följ användarens instruktioner exakt. Generera två versioner: en kort beskrivning (max 50 ord) och en lång HTML-beskrivning (max 200 ord). Svara i JSON-format: {"short_sv": "kort beskrivning", "long_html_sv": "<p>lång HTML-beskrivning</p>"}`;

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
          max_tokens: 1200
        })
      }, RETRY_CONFIG);

      const data = await response.json();
      console.debug(`[LLM] Brand optimization completed successfully with mode: ${mode}`);
      
      // Try to parse JSON response
      try {
        const result = JSON.parse(data.choices[0].message.content);
        return {
          short_sv: result.short_sv || '',
          long_html_sv: result.long_html_sv || ''
        };
      } catch (parseError) {
        console.warn('Failed to parse brand optimization JSON, using fallback');
        const content = data.choices[0].message.content;
        return {
          short_sv: content.substring(0, 200),
          long_html_sv: `<p>${content}</p>`
        };
      }
      
    } catch (error) {
      console.error('OpenAI brand optimize error:', error);
      console.debug(`[LLM] Brand optimization failed with mode: ${mode}, falling back to stub`);
      // Fall back to stub on error
    }
  }
  
  // Stub implementation for brands
  const snippet = input.descriptionSv
    .substring(0, 240)
    .trim();
  
  let attributesSection = '';
  if (input.attributes) {
    const attrs = typeof input.attributes === 'string' ? input.attributes : JSON.stringify(input.attributes);
    attributesSection = `\n\nSpecifikationer\n${attrs}`;
  }

  const shortResult = `${input.nameSv} - Kvalitetsprodukt med pålitlig funktionalitet. Perfekt för professionellt och privat bruk.`;
  
  const longResult = `<h2>${input.nameSv}</h2>
<p>Kort introduktion</p>
<p>${snippet}</p>

<p>Varumärkesbeskrivning</p>
<p>Detta varumärke erbjuder pålitlig funktionalitet för dina behov. Med sin kvalitetsbyggnad och användarvänliga design ger det dig en smidig upplevelse. Perfekt för både professionellt och privat bruk.</p>

<h3>Höjdpunkter (för UX, CRO och AI Overview)</h3>
<ul>
<li>Hög kvalitet och pålitlighet</li>
<li>Användarvänlig design och funktionalitet</li>
<li>Mångsidig användning</li>
<li>Kostnadseffektiv lösning</li>
<li>Snabb leverans och support</li>
</ul>${attributesSection}

<h3>Meta (valfritt)</h3>
<p>Meta Title: ${input.nameSv} - Professionell lösning för dina behov</p>
<p>Meta Description: Upptäck ${input.nameSv} - en pålitlig och användarvänlig produkt som ger dig kvalitet och funktionalitet. Beställ nu för snabb leverans!</p>`;

  console.debug(`[LLM] Stub brand optimization completed successfully with mode: ${mode}`);
  return {
    short_sv: shortResult,
    long_html_sv: longResult
  };
}

/**
 * Translate text to any language using live OpenAI or stub
 */
export async function translateTo(input: TranslateInput, options?: {
  model?: string;
  sourceLang?: string;
}): Promise<string> {
  // Use live OpenAI if available and mode is live
  if (HAS_OPENAI && OPENAI_MODE === 'live') {
    try {
      // Get configuration from settings or ENV fallback
      const config = await getOpenAIConfig();
      if (options?.model) config.model = options.model;
      
      // Get language name from language code
      const languageNames: Record<string, string> = {
        'da': 'danska',
        'nb': 'norsk bokmål',
        'no': 'norska',
        'en': 'engelska',
        'de': 'tyska',
        'fr': 'franska',
        'es': 'spanska',
        'it': 'italienska',
        'pt': 'portugisiska',
        'nl': 'holländska',
        'pl': 'polska',
        'ru': 'ryska',
        'fi': 'finska',
        'sv': 'svenska'
      };
      
      const targetLang = languageNames[input.target] || input.target;
      const sourceLang = options?.sourceLang || 'sv';
      
      // Get glossary from settings
      let glossaryContext = '';
      let glossaryMappings: Array<{source: string, target: string}> = [];
      
      if (config.glossary) {
        try {
          const glossary = JSON.parse(config.glossary);
          glossaryContext = buildGlossaryContext(glossary, sourceLang, input.target);
          
          // Build mappings for post-processing
          const relevantEntries = glossary.filter((entry: any) => 
            entry.targets && entry.targets[input.target]
          );
          glossaryMappings = relevantEntries.map((entry: any) => ({
            source: entry.source,
            target: entry.targets[input.target]
          }));
        } catch (error) {
          console.warn('Failed to parse glossary:', error);
        }
      }
      
      // Direct translation prompt - preserve structure exactly
      const systemPrompt = `Du är en expert på översättning. Översätt texten exakt till ${targetLang} medan du bevarar all struktur, rubriker, punktlistor och formatering. Behåll alla siffror, varumärken och tekniska termer oförändrade.${glossaryContext}`;
      
      const userPrompt = `Översätt följande text till ${targetLang}:

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
      let translatedText = data.choices[0].message.content;
      
      // Apply glossary post-processing
      if (glossaryMappings.length > 0) {
        translatedText = applyGlossary(translatedText, glossaryMappings);
      }
      
      return translatedText;
      
    } catch (error) {
      console.error('OpenAI translate error:', error);
      // Fall back to stub on error
    }
  }
  
  // Stub implementation (preserves exact structure from tests)
  // Add small delay to simulate real API call
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  const langCode = input.target.toUpperCase();
  const langSuffix = ` [${langCode}]`;
  
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
