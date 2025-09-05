/**
 * Format guard utility for translation results
 * Removes extra # characters that might be added by LLM
 */

/**
 * Removes leading # characters from translation result if original didn't start with #
 * @param originalText - The original Swedish text
 * @param translatedText - The translated text
 * @returns Cleaned translated text
 */
export function cleanTranslationFormat(originalText: string, translatedText: string): string {
  // If original doesn't start with #, remove any leading # from translation
  if (!originalText.trim().startsWith('#')) {
    // Remove leading # characters and following space (but preserve ## and ###)
    return translatedText.replace(/^#(?![#])\s?/gm, '');
  }
  
  return translatedText;
}

// TODO: ersätt med striktare strukturvalidering om behövs
