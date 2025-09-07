// ISO-639-1 language codes with Swedish names
export const LANGUAGES = [
  { code: 'da', name: 'Danska' },
  { code: 'no', name: 'Norska' },
  { code: 'en', name: 'Engelska' },
  { code: 'de', name: 'Tyska' },
  { code: 'fr', name: 'Franska' },
  { code: 'es', name: 'Spanska' },
  { code: 'it', name: 'Italienska' },
  { code: 'pt', name: 'Portugisiska' },
  { code: 'nl', name: 'Holländska' },
  { code: 'pl', name: 'Polska' },
  { code: 'ru', name: 'Ryska' },
  { code: 'fi', name: 'Finska' },
  { code: 'sv', name: 'Svenska' },
  { code: 'cs', name: 'Tjeckiska' },
  { code: 'hu', name: 'Ungerska' },
  { code: 'ro', name: 'Rumänska' },
  { code: 'bg', name: 'Bulgariska' },
  { code: 'hr', name: 'Kroatiska' },
  { code: 'sk', name: 'Slovakiska' },
  { code: 'sl', name: 'Slovenska' },
  { code: 'et', name: 'Estniska' },
  { code: 'lv', name: 'Lettiska' },
  { code: 'lt', name: 'Litauiska' },
  { code: 'el', name: 'Grekiska' },
  { code: 'tr', name: 'Turkiska' },
  { code: 'ar', name: 'Arabiska' },
  { code: 'he', name: 'Hebreiska' },
  { code: 'ja', name: 'Japanska' },
  { code: 'ko', name: 'Koreanska' },
  { code: 'zh', name: 'Kinesiska' },
  { code: 'th', name: 'Thailändska' },
  { code: 'vi', name: 'Vietnamesiska' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fa', name: 'Persiska' },
  { code: 'sw', name: 'Swahili' },
  { code: 'am', name: 'Amhariska' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'zu', name: 'Zulu' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanska' },
  { code: 'az', name: 'Azerbajdzjanska' },
  { code: 'eu', name: 'Baskiska' },
  { code: 'be', name: 'Vitrysska' },
  { code: 'bs', name: 'Bosniska' },
  { code: 'ca', name: 'Katalanska' },
  { code: 'cy', name: 'Walesiska' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'fo', name: 'Färöiska' },
  { code: 'gl', name: 'Galiciska' },
  { code: 'is', name: 'Isländska' },
  { code: 'ga', name: 'Irländska' },
  { code: 'mk', name: 'Makedonska' },
  { code: 'mt', name: 'Maltesiska' },
  { code: 'mo', name: 'Moldaviska' },
  { code: 'nn', name: 'Nynorska' },
  { code: 'nb', name: 'Bokmål' },
  { code: 'uk', name: 'Ukrainska' },
  { code: 'uz', name: 'Uzbekiska' },
  { code: 'ka', name: 'Georgiska' },
  { code: 'hy', name: 'Armeniska' },
  { code: 'kk', name: 'Kazakiska' },
  { code: 'ky', name: 'Kirgiziska' },
  { code: 'mn', name: 'Mongoliska' },
  { code: 'ne', name: 'Nepali' },
  { code: 'si', name: 'Singalesiska' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'or', name: 'Oriya' },
  { code: 'as', name: 'Assamesiska' },
  { code: 'mr', name: 'Marathi' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'my', name: 'Burmesiska' },
  { code: 'km', name: 'Khmer' },
  { code: 'lo', name: 'Lao' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

export function getLanguageName(code: string): string {
  const language = LANGUAGES.find(lang => lang.code === code);
  return language ? language.name : code.toUpperCase();
}

export function getLanguageDisplayName(code: string): string {
  const language = LANGUAGES.find(lang => lang.code === code);
  return language ? `${language.name} (${code})` : code.toUpperCase();
}

export function searchLanguages(query: string): Array<{ code: string; name: string }> {
  const lowerQuery = query.toLowerCase();
  return LANGUAGES.filter(lang => 
    lang.name.toLowerCase().includes(lowerQuery) || 
    lang.code.toLowerCase().includes(lowerQuery)
  );
}
