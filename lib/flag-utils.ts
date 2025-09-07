// Language code to country mapping for flag emojis
export interface LanguageInfo {
  countryCode: string;
  display: string;
  emoji: string;
}

// Mapping from language codes to country codes and display names
const LANGUAGE_TO_COUNTRY: Record<string, LanguageInfo> = {
  'sv': { countryCode: 'SE', display: 'Svenska', emoji: '🇸🇪' },
  'da': { countryCode: 'DK', display: 'Danska', emoji: '🇩🇰' },
  'no': { countryCode: 'NO', display: 'Norska', emoji: '🇳🇴' },
  'en': { countryCode: 'GB', display: 'Engelska', emoji: '🇬🇧' },
  'de': { countryCode: 'DE', display: 'Tyska', emoji: '🇩🇪' },
  'fr': { countryCode: 'FR', display: 'Franska', emoji: '🇫🇷' },
  'es': { countryCode: 'ES', display: 'Spanska', emoji: '🇪🇸' },
  'it': { countryCode: 'IT', display: 'Italienska', emoji: '🇮🇹' },
  'pt': { countryCode: 'PT', display: 'Portugisiska', emoji: '🇵🇹' },
  'nl': { countryCode: 'NL', display: 'Holländska', emoji: '🇳🇱' },
  'pl': { countryCode: 'PL', display: 'Polska', emoji: '🇵🇱' },
  'ru': { countryCode: 'RU', display: 'Ryska', emoji: '🇷🇺' },
  'fi': { countryCode: 'FI', display: 'Finska', emoji: '🇫🇮' },
  'cs': { countryCode: 'CZ', display: 'Tjeckiska', emoji: '🇨🇿' },
  'hu': { countryCode: 'HU', display: 'Ungerska', emoji: '🇭🇺' },
  'ro': { countryCode: 'RO', display: 'Rumänska', emoji: '🇷🇴' },
  'bg': { countryCode: 'BG', display: 'Bulgariska', emoji: '🇧🇬' },
  'hr': { countryCode: 'HR', display: 'Kroatiska', emoji: '🇭🇷' },
  'sk': { countryCode: 'SK', display: 'Slovakiska', emoji: '🇸🇰' },
  'sl': { countryCode: 'SI', display: 'Slovenska', emoji: '🇸🇮' },
  'et': { countryCode: 'EE', display: 'Estniska', emoji: '🇪🇪' },
  'lv': { countryCode: 'LV', display: 'Lettiska', emoji: '🇱🇻' },
  'lt': { countryCode: 'LT', display: 'Litauiska', emoji: '🇱🇹' },
  'el': { countryCode: 'GR', display: 'Grekiska', emoji: '🇬🇷' },
  'tr': { countryCode: 'TR', display: 'Turkiska', emoji: '🇹🇷' },
  'ar': { countryCode: 'SA', display: 'Arabiska', emoji: '🇸🇦' },
  'he': { countryCode: 'IL', display: 'Hebreiska', emoji: '🇮🇱' },
  'ja': { countryCode: 'JP', display: 'Japanska', emoji: '🇯🇵' },
  'ko': { countryCode: 'KR', display: 'Koreanska', emoji: '🇰🇷' },
  'zh': { countryCode: 'CN', display: 'Kinesiska', emoji: '🇨🇳' },
  'th': { countryCode: 'TH', display: 'Thailändska', emoji: '🇹🇭' },
  'vi': { countryCode: 'VN', display: 'Vietnamesiska', emoji: '🇻🇳' },
  'hi': { countryCode: 'IN', display: 'Hindi', emoji: '🇮🇳' },
  'bn': { countryCode: 'BD', display: 'Bengali', emoji: '🇧🇩' },
  'ur': { countryCode: 'PK', display: 'Urdu', emoji: '🇵🇰' },
  'fa': { countryCode: 'IR', display: 'Persiska', emoji: '🇮🇷' },
  'sw': { countryCode: 'KE', display: 'Swahili', emoji: '🇰🇪' },
  'am': { countryCode: 'ET', display: 'Amhariska', emoji: '🇪🇹' },
  'yo': { countryCode: 'NG', display: 'Yoruba', emoji: '🇳🇬' },
  'zu': { countryCode: 'ZA', display: 'Zulu', emoji: '🇿🇦' },
  'af': { countryCode: 'ZA', display: 'Afrikaans', emoji: '🇿🇦' },
  'sq': { countryCode: 'AL', display: 'Albanska', emoji: '🇦🇱' },
  'az': { countryCode: 'AZ', display: 'Azerbajdzjanska', emoji: '🇦🇿' },
  'eu': { countryCode: 'ES', display: 'Baskiska', emoji: '🇪🇸' },
  'be': { countryCode: 'BY', display: 'Vitrysska', emoji: '🇧🇾' },
  'bs': { countryCode: 'BA', display: 'Bosniska', emoji: '🇧🇦' },
  'ca': { countryCode: 'ES', display: 'Katalanska', emoji: '🇪🇸' },
  'cy': { countryCode: 'GB', display: 'Walesiska', emoji: '🇬🇧' },
  'eo': { countryCode: 'XX', display: 'Esperanto', emoji: '🏳️' },
  'fo': { countryCode: 'FO', display: 'Färöiska', emoji: '🇫🇴' },
  'gl': { countryCode: 'ES', display: 'Galiciska', emoji: '🇪🇸' },
  'is': { countryCode: 'IS', display: 'Isländska', emoji: '🇮🇸' },
  'ga': { countryCode: 'IE', display: 'Irländska', emoji: '🇮🇪' },
  'mk': { countryCode: 'MK', display: 'Makedonska', emoji: '🇲🇰' },
  'mt': { countryCode: 'MT', display: 'Maltesiska', emoji: '🇲🇹' },
  'mo': { countryCode: 'MD', display: 'Moldaviska', emoji: '🇲🇩' },
  'nn': { countryCode: 'NO', display: 'Nynorska', emoji: '🇳🇴' },
  'nb': { countryCode: 'NO', display: 'Bokmål', emoji: '🇳🇴' },
  'uk': { countryCode: 'UA', display: 'Ukrainska', emoji: '🇺🇦' },
  'uz': { countryCode: 'UZ', display: 'Uzbekiska', emoji: '🇺🇿' },
  'ka': { countryCode: 'GE', display: 'Georgiska', emoji: '🇬🇪' },
  'hy': { countryCode: 'AM', display: 'Armeniska', emoji: '🇦🇲' },
  'kk': { countryCode: 'KZ', display: 'Kazakiska', emoji: '🇰🇿' },
  'ky': { countryCode: 'KG', display: 'Kirgiziska', emoji: '🇰🇬' },
  'mn': { countryCode: 'MN', display: 'Mongoliska', emoji: '🇲🇳' },
  'ne': { countryCode: 'NP', display: 'Nepali', emoji: '🇳🇵' },
  'si': { countryCode: 'LK', display: 'Singalesiska', emoji: '🇱🇰' },
  'ta': { countryCode: 'IN', display: 'Tamil', emoji: '🇮🇳' },
  'te': { countryCode: 'IN', display: 'Telugu', emoji: '🇮🇳' },
  'ml': { countryCode: 'IN', display: 'Malayalam', emoji: '🇮🇳' },
  'kn': { countryCode: 'IN', display: 'Kannada', emoji: '🇮🇳' },
  'gu': { countryCode: 'IN', display: 'Gujarati', emoji: '🇮🇳' },
  'pa': { countryCode: 'IN', display: 'Punjabi', emoji: '🇮🇳' },
  'or': { countryCode: 'IN', display: 'Oriya', emoji: '🇮🇳' },
  'as': { countryCode: 'IN', display: 'Assamesiska', emoji: '🇮🇳' },
  'mr': { countryCode: 'IN', display: 'Marathi', emoji: '🇮🇳' },
  'sa': { countryCode: 'IN', display: 'Sanskrit', emoji: '🇮🇳' },
  'sd': { countryCode: 'PK', display: 'Sindhi', emoji: '🇵🇰' },
  'my': { countryCode: 'MM', display: 'Burmesiska', emoji: '🇲🇲' },
  'km': { countryCode: 'KH', display: 'Khmer', emoji: '🇰🇭' },
  'lo': { countryCode: 'LA', display: 'Lao', emoji: '🇱🇦' },
};

/**
 * Get language information including country code, display name, and flag emoji
 * @param code - Language code (e.g., 'sv', 'da', 'no')
 * @returns LanguageInfo object with countryCode, display name, and emoji
 */
export function codeToCountry(code: string): LanguageInfo {
  const languageInfo = LANGUAGE_TO_COUNTRY[code.toLowerCase()];
  
  if (languageInfo) {
    return languageInfo;
  }
  
  // Fallback for unknown languages
  return {
    countryCode: code.toUpperCase(),
    display: code.toUpperCase(),
    emoji: '🏳️'
  };
}
