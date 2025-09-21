import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/encryption';
import { OPENAI_API_KEY, OPENAI_MODEL_OPTIMIZE, OPENAI_MODEL_TRANSLATE } from '@/lib/env';

/**
 * OpenAI configuration from settings or environment fallback
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  promptOptimizeSv: string;
  promptOptimizeBrandsSv?: string | null;
  promptTranslateDirect: string;
  exampleProductImportTokens?: string | null;
  exampleBrandsImportTokens?: string | null;
  glossary?: string | null;
}

/**
 * Get OpenAI configuration from settings with ENV fallback
 * Priority: Settings → ENV → Error
 */
export async function getOpenAIConfig(): Promise<OpenAIConfig> {
  // Try to get settings from database
  const settings = await prisma.openAISettings.findFirst({
    orderBy: { updated_at: 'desc' }
  });

  if (settings) {
    // Use settings if available
    const apiKey = settings.openaiApiKeyEnc 
      ? decryptSecret(settings.openaiApiKeyEnc)
      : OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured in settings or environment');
    }

    return {
      apiKey,
      model: settings.openaiModel,
      promptOptimizeSv: settings.promptOptimizeSv,
      promptOptimizeBrandsSv: settings.promptOptimizeBrandsSv,
      promptTranslateDirect: settings.promptTranslateDirect,
      exampleProductImportTokens: settings.exampleProductImportTokens,
      exampleBrandsImportTokens: settings.exampleBrandsImportTokens,
      glossary: settings.glossary
    };
  }

  // Fallback to environment variables
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured in settings or environment');
  }

  return {
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL_OPTIMIZE, // Use optimize model as default
    promptOptimizeSv: `Du är en senior e-handelscopywriter och SEO-strateg. Skriv om svenska produkttexter så att de blir lättläsa, säljande men sakliga, och optimerade för UX, CRO, SEO och AI Overview. Bevara fakta, varumärken och siffror exakt. Inga hallucinationer.`,
    promptOptimizeBrandsSv: `Du är en expert på varumärkeskommunikation och copywriting. Skapa engagerande varumärkesbeskrivningar som är professionella, säljande och informativa. Fokusera på varumärkets unika värde och målgrupp.`,
    promptTranslateDirect: `Du är en professionell översättare. Översätt svensk text till {targetLang}.

Regler:
- Översätt verbatim utan att ändra struktur/HTML/markdown
- Lägg INTE till #/## rubriknivåer, listtecken eller extra text
- Behåll {{...}}, radbrytningar, taggar och ordningen exakt
- Översätt endast textnoder
- Temperatur: 0 (exakt översättning)`,
    exampleProductImportTokens: null,
    exampleBrandsImportTokens: null,
    glossary: null
  };
}
