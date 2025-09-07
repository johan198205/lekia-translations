/**
 * Apply glossary mappings to text with word boundary sensitivity
 * @param text - The text to process
 * @param mappings - Array of {source, target} mappings
 * @returns Text with glossary terms replaced
 */
export function applyGlossary(text: string, mappings: Array<{source: string, target: string}>): string {
  if (!text || !mappings || mappings.length === 0) {
    return text;
  }

  let result = text;

  // Sort mappings by source length (longest first) to avoid partial replacements
  const sortedMappings = [...mappings].sort((a, b) => b.source.length - a.source.length);

  for (const mapping of sortedMappings) {
    const { source, target } = mapping;
    
    if (!source || !target) continue;

    // Create regex with word boundaries, case-insensitive
    // Escape special regex characters in source
    const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSource}\\b`, 'gi');
    
    // Replace with target, preserving original case pattern
    result = result.replace(regex, (match) => {
      // Preserve case pattern from original
      if (match === match.toUpperCase()) {
        return target.toUpperCase();
      } else if (match === match.toLowerCase()) {
        return target.toLowerCase();
      } else if (match[0] === match[0].toUpperCase()) {
        return target[0].toUpperCase() + target.slice(1).toLowerCase();
      } else {
        return target;
      }
    });
  }

  return result;
}

/**
 * Build glossary context for prompt injection
 * @param glossary - Array of glossary entries
 * @param sourceLang - Source language code
 * @param targetLang - Target language code
 * @returns Formatted glossary context string
 */
export function buildGlossaryContext(
  glossary: Array<{id: string, source: string, comment?: string, targets: Record<string, string>}>,
  sourceLang: string,
  targetLang: string
): string {
  if (!glossary || glossary.length === 0) {
    return '';
  }

  // Filter entries that have target for the target language
  const relevantEntries = glossary.filter(entry => 
    entry.targets && entry.targets[targetLang]
  );

  if (relevantEntries.length === 0) {
    return '';
  }

  const languageNames: Record<string, string> = {
    'sv': 'svenska',
    'da': 'danska', 
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
    'fi': 'finska'
  };

  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;

  let context = `\n\nGlossary (måste följas – exakt ordval):\n${sourceLangName} → ${targetLangName}:\n`;
  
  for (const entry of relevantEntries) {
    context += `- "${entry.source}" => "${entry.targets[targetLang]}"\n`;
  }
  
  context += `\nRegler: använd exakt målterm, ändra inte form/böjning, behåll casing så nära källans stil som möjligt. Översätt övrig text rakt av, bevara markup/struktur.`;

  return context;
}
