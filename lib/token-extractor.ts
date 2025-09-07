/**
 * Token extraction utility for product import files
 * Extracts column headers and normalizes them to tokens for use in prompts
 */

export interface TokenInfo {
  original: string;
  token: string;
  alias?: string;
}

export interface ExtractedTokens {
  tokens: TokenInfo[];
  systemTokens: string[];
}

// Column aliases for common product fields
const COLUMN_ALIASES: Record<string, string> = {
  'articleid': 'articleId',
  'title': 'title',
  'produktnamn': 'title',
  'description_sv': 'sv_description',
  'beskrivning_sv': 'sv_description',
  'brand': 'brand',
  'märke': 'brand',
  'category': 'category',
  'kategori': 'category',
  'price': 'price',
  'pris': 'price',
  'ean': 'gtin',
  'gtin': 'gtin',
  'sku': 'sku',
  'color': 'color',
  'färg': 'color',
  'size': 'size',
  'storlek': 'size',
  'material': 'material',
  'age': 'age',
  'ålder': 'age',
  'weight': 'weight',
  'vikt': 'weight',
  'dimensions': 'dimensions',
  'mått': 'dimensions',
};

// System tokens that are always available
const SYSTEM_TOKENS = ['targetLang', 'jobType', 'uploadName', 'batchName'];

/**
 * Normalize a column header to a token
 * - Trim whitespace
 * - Replace non-alphanumeric characters (except _ and -) with _
 * - Convert to lowercase
 * - Preserve ISO locale codes (e.g., sv-SE)
 */
export function normalizeToken(header: string): string {
  // Handle ISO locale codes specially (e.g., sv-SE, en-US)
  const localeMatch = header.match(/^([a-z]{2})-([A-Z]{2})$/i);
  if (localeMatch) {
    return header.toLowerCase();
  }

  return header
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .toLowerCase();
}

/**
 * Extract tokens from column headers
 */
export function extractTokens(headers: string[]): ExtractedTokens {
  const tokens: TokenInfo[] = [];
  const bulletTokens: string[] = [];

  for (const header of headers) {
    const normalized = normalizeToken(header);
    
    // Skip empty headers
    if (!normalized) continue;

    // Handle bullet/feature columns
    if (normalized.startsWith('bullet') || normalized.startsWith('feature')) {
      bulletTokens.push(normalized);
      continue;
    }

    // Check for aliases
    const alias = COLUMN_ALIASES[normalized];
    
    tokens.push({
      original: header,
      token: normalized,
      alias: alias || undefined
    });
  }

  // Add bullets array token if we found bullet columns
  if (bulletTokens.length > 0) {
    tokens.push({
      original: 'Bullet points',
      token: 'bullets[]',
      alias: 'bullets[]'
    });
  }

  return {
    tokens,
    systemTokens: [...SYSTEM_TOKENS]
  };
}

/**
 * Get available tokens for prompt building
 * Returns tokens from upload meta or falls back to settings example
 */
export function getAvailableTokens(
  uploadTokens?: TokenInfo[],
  settingsTokens?: TokenInfo[]
): TokenInfo[] {
  if (uploadTokens && uploadTokens.length > 0) {
    return uploadTokens;
  }
  
  if (settingsTokens && settingsTokens.length > 0) {
    return settingsTokens;
  }
  
  return [];
}

/**
 * Replace tokens in a prompt template
 * Only replaces tokens that exist in availableTokens
 */
export function replaceTokens(
  template: string,
  availableTokens: TokenInfo[],
  values: Record<string, string>
): string {
  let result = template;
  
  // Create a map of available tokens for quick lookup
  const tokenMap = new Map<string, string>();
  availableTokens.forEach(tokenInfo => {
    tokenMap.set(`{{${tokenInfo.token}}}`, values[tokenInfo.token] || '');
    if (tokenInfo.alias) {
      tokenMap.set(`{{${tokenInfo.alias}}}`, values[tokenInfo.alias] || '');
    }
  });

  // Replace all available tokens
  tokenMap.forEach((value, token) => {
    result = result.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return result;
}

/**
 * Generate context block for used tokens
 */
export function generateContextBlock(
  availableTokens: TokenInfo[],
  values: Record<string, string>
): string {
  const usedTokens = availableTokens.filter(tokenInfo => {
    const value = values[tokenInfo.token] || (tokenInfo.alias ? values[tokenInfo.alias] : '');
    return value && value.trim().length > 0;
  });

  if (usedTokens.length === 0) {
    return '';
  }

  const contextLines = usedTokens.map(tokenInfo => {
    const value = values[tokenInfo.token] || (tokenInfo.alias ? values[tokenInfo.alias] : '');
    const displayValue = value.length > 100 ? `"""${value}"""` : value;
    return `${tokenInfo.token}: ${displayValue}`;
  });

  return `\n\nContext:\n${contextLines.join('\n')}`;
}
