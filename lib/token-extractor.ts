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
  // Basic product info
  'articleid': 'articleId',
  'artikelnummer': 'articleId',
  'title': 'title',
  'produktnamn': 'title',
  'namn_sv-se': 'title',
  'namn_sv_se': 'title',
  
  // Descriptions
  'description_sv': 'sv_description',
  'beskrivning_sv': 'sv_description',
  'beskrivning_id_descriptionhtml_sv-se': 'sv_description',
  'beskrivning_id_descriptionhtml_sv_se': 'sv_description',
  'kort_beskrivning_sv-se': 'short_description',
  'kort_beskrivning_sv_se': 'short_description',
  'sökmotoranpassad_beskrivning_sv-se': 'seo_description',
  'sökmotoranpassad_beskrivning_sv_se': 'seo_description',
  
  // Brand information
  'brand': 'brand',
  'märke': 'brand',
  'märke_text_märke_1': 'brand_text_1',
  'märke_fritext_märke_1_sv-se': 'brand_free_text_1',
  'märke_fritext_märke_1_sv_se': 'brand_free_text_1',
  'märke_text_märke_2': 'brand_text_2',
  'märke_fritext_märke_2_sv-se': 'brand_free_text_2',
  'märke_fritext_märke_2_sv_se': 'brand_free_text_2',
  'länk_till_varumärke': 'brand_link',
  
  // Product details
  'category': 'category',
  'kategori': 'category',
  'produktklass': 'product_class',
  'katalog': 'catalog',
  'varugrupp': 'product_group',
  'tillverkare': 'manufacturer',
  'tillverkarens_artikelnummer': 'manufacturer_sku',
  'mpn': 'mpn',
  'lob_sku': 'lob_sku',
  'lima_sku': 'lima_sku',
  
  // Pricing
  'price': 'price',
  'pris': 'price',
  'inpris': 'cost_price',
  'lågpris': 'low_price',
  
  // Physical attributes
  'color': 'color',
  'färg': 'color',
  'size': 'size',
  'storlek': 'size',
  'material': 'material',
  'age': 'age',
  'ålder': 'age',
  'ålder_till': 'age_to',
  'ålder_från': 'age_from',
  'weight': 'weight',
  'vikt': 'weight',
  'kfp_vikt_id_consumerpackagingweight': 'packaging_weight',
  'kfp_vikt_id_consumerpackagingweight': 'packaging_weight',
  'dimensions': 'dimensions',
  'mått': 'dimensions',
  'höjd': 'height',
  'kfp_höjd_id_consumerpackagingheight': 'packaging_height',
  'kfp_höjd_id_consumerpackagingheight': 'packaging_height',
  'längd': 'length',
  'kfp_längd_id_consumerpackaginglength': 'packaging_length',
  'kfp_längd_id_consumerpackaginglength': 'packaging_length',
  'kfp_bredd': 'packaging_width',
  
  // Identifiers
  'ean': 'gtin',
  'gtin': 'gtin',
  'sku': 'sku',
  'statistiskt_nummer': 'statistical_number',
  'äldre_artikel-id': 'old_article_id',
  
  // System info
  'ursprungssystem': 'origin_system',
  'ursprungsland': 'origin_country',
  'första_publiceringsdatum': 'first_publish_date',
  'artikelstatus': 'article_status',
  'produkten_är_ett_presentkort': 'is_gift_card',
  'endast_för_boka_i_butik': 'book_in_store_only',
  'har_click_and_collect': 'has_click_and_collect',
  'produkt_dagar_som_nyhet': 'new_product_days',
  
  // SEO and URLs
  'url_sv-se': 'url',
  'url_sv_se': 'url',
  'sökmotoranpassad_titel_sv-se': 'seo_title',
  'sökmotoranpassad_titel_sv_se': 'seo_title',
  'extra_sökord_sv-se': 'extra_search_terms',
  'extra_sökord_sv_se': 'extra_search_terms',
  'google_produktkategori': 'google_product_category',
  'google_custom_label_0': 'google_custom_label_0',
  
  // Product features
  'serie': 'series',
  'produktblad_sv-se': 'product_sheet',
  'produktblad_sv_se': 'product_sheet',
  'antal_delar': 'piece_count',
  'pieces': 'piece_count',
  
  // Variants
  'variantav': 'variant_of',
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
