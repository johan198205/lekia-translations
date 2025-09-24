import * as ExcelJS from 'exceljs';
import { extractTokens, ExtractedTokens } from '@/lib/token-extractor';

export interface Product {
  name_sv: string;
  description_sv: string;
  description_html_sv?: string; // Long description
  seo_title_sv?: string;
  seo_description_sv?: string;
  attributes?: string;
  tone_hint?: string;
  raw_data?: Record<string, any>; // All original Excel columns
}

export interface UIString {
  name: string;
  values: Record<string, string>;
}

export interface Brand {
  name_sv: string;
  description_sv: string;
  attributes?: string;
  tone_hint?: string;
  raw_data?: Record<string, any>; // All original Excel columns
}

export interface NormalizeResult {
  products?: Product[];
  uiStrings?: UIString[];
  brands?: Brand[];
  meta: {
    rows: number;
    skipped: number;
    locales?: string[];
    tokens?: ExtractedTokens;
    detectedLanguages?: string[];
    suggestedOriginalLanguage?: string;
    headers?: string[]; // For brands: exact Excel headers in order
  };
}

const HEADER_ALIASES = {
  name_sv: [
    'product_name_sv', 'name_sv', 'product_name', 'name',
    'namn_sv-se', 'namn_sv_se', 'namn,sv-se', 'namn, sv-se', 'namn sv-se',
    'produktnamn', 'title', 'namn'
  ],
  description_sv: [
    'description_sv', 'description', 'product_description',
    'kort_beskrivning_sv-se', 'kort_beskrivning_sv_se',
    'kort beskrivning,sv-se', 'kort beskrivning, sv-se', 'kort beskrivning sv-se'
  ],
  description_html_sv: [
    '"beskrivning (id: descriptionhtml)",sv-se', 'beskrivning (id: descriptionhtml),sv-se',
    'beskrivning (id: descriptionhtml), sv-se', 'beskrivning (id: descriptionhtml) sv-se',
    'beskrivning_id_descriptionhtml_sv-se', 'beskrivning_id_descriptionhtml_sv_se',
    'produktblad,sv-se', 'produktblad, sv-se', 'produktblad sv-se'
  ],
  seo_title_sv: [
    'sökmotoranpassad_titel_sv-se', 'sökmotoranpassad_titel_sv_se',
    'sökmotoranpassad titel,sv-se', 'sökmotoranpassad titel, sv-se', 'sökmotoranpassad titel sv-se'
  ],
  seo_description_sv: [
    'sökmotoranpassad_beskrivning_sv-se', 'sökmotoranpassad_beskrivning_sv_se',
    'sökmotoranpassad beskrivning,sv-se', 'sökmotoranpassad beskrivning, sv-se',
    'sökmotoranpassad beskrivning sv-se'
  ],
  attributes: ['attributes', 'spec', 'specification', 'specs'],
  tone_hint: ['tone_hint', 'tone', 'style'],
} as const;

const REQUIRED_COLUMNS = {
  product_texts: ['name_sv'], // Only name is required, descriptions are optional
  ui_strings: [],
  brands: [] // Brands don't have required columns
} as const;
const MAX_DESCRIPTION_LENGTH = 4000;

export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}

export async function normalize(buffer: Buffer | ArrayBuffer, jobType: 'product_texts' | 'ui_strings' = 'product_texts'): Promise<NormalizeResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    // Convert to Buffer if needed and use any to bypass type issues
    const bufferData = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    await workbook.xlsx.load(bufferData as any);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new NormalizationError('Invalid workbook');
    }

    if (jobType === 'ui_strings') {
      return await normalizeUIStrings(worksheet);
    } else if (jobType === 'brands') {
      return await normalizeBrands(worksheet);
    } else {
      return await normalizeProducts(worksheet);
    }
  } catch (error) {
    if (error instanceof NormalizationError) {
      throw error;
    }
    throw new NormalizationError('Invalid workbook');
  }
}

async function normalizeProducts(worksheet: ExcelJS.Worksheet): Promise<NormalizeResult> {
  const headers = getNormalizedHeaders(worksheet);
  console.log('[NORMALIZE] Headers found:', headers);
  validateRequiredColumns(headers, 'product_texts');
  
  // Extract tokens from all column headers
  const allHeaders = getAllHeaders(worksheet);
  console.log('[NORMALIZE] All headers:', allHeaders);
  let extractedTokens;
  try {
    extractedTokens = extractTokens(allHeaders);
  } catch (error) {
    console.warn('Failed to extract tokens:', error);
    extractedTokens = { tokens: [], systemTokens: [] };
  }

  // Detect language patterns in headers
  const detectedLanguages = detectLanguagePatterns(allHeaders);
  const suggestedOriginalLanguage = suggestOriginalLanguage(allHeaders, detectedLanguages);
  
  const products: Product[] = [];
  let skipped = 0;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    if (isEmptyRow(row)) {
      skipped++;
      return;
    }
    
    const product = parseProductRow(row, headers);
    console.log(`[NORMALIZE] Row ${rowNumber}:`, product ? 'parsed successfully' : 'failed to parse');
    if (product) {
      products.push(product);
    }
  });

  console.log(`[NORMALIZE] Total products parsed: ${products.length}, skipped: ${skipped}`);

  return {
    products,
    meta: {
      rows: products.length,
      skipped,
      tokens: extractedTokens,
      detectedLanguages,
      suggestedOriginalLanguage,
    },
  };
}

async function normalizeUIStrings(worksheet: ExcelJS.Worksheet): Promise<NormalizeResult> {
  const headers = getUIStringHeaders(worksheet);
  validateUIStringColumns(headers);
  
  const uiStrings: UIString[] = [];
  let skipped = 0;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    if (isEmptyRow(row)) {
      skipped++;
      return;
    }
    
    const uiString = parseUIStringRow(row, headers);
    if (uiString) {
      uiStrings.push(uiString);
    }
  });

  // Extract language codes from locales for detected languages
  const detectedLanguages: string[] = [];
  headers.locales.forEach(locale => {
    // Extract language code from locale (e.g., "nb-NO" -> "nb", "en-US" -> "en", "sv-SE" -> "sv")
    const langCode = locale.split('-')[0].toLowerCase();
    if (!detectedLanguages.includes(langCode)) {
      detectedLanguages.push(langCode);
    }
  });

  return {
    uiStrings,
    meta: {
      rows: uiStrings.length,
      skipped,
      locales: headers.locales,
      detectedLanguages: detectedLanguages.sort(),
    },
  };
}

function getNormalizedHeaders(worksheet: ExcelJS.Worksheet): Record<string, number> {
  const headerRow = worksheet.getRow(1);
  const headers: Record<string, number> = {};
  
  // First pass: find all matching columns
  const matchingColumns: Record<string, number[]> = {};
  
  headerRow.eachCell((cell, colNumber) => {
    const headerValue = String(cell.value || '').trim();
    const lowerHeaderValue = headerValue.toLowerCase();
    
    console.log(`[HEADERS] Column ${colNumber}: "${headerValue}" (lowercase: "${lowerHeaderValue}")`);
    
    for (const [normalizedKey, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(alias => alias.toLowerCase() === lowerHeaderValue)) {
        if (!matchingColumns[normalizedKey]) {
          matchingColumns[normalizedKey] = [];
        }
        matchingColumns[normalizedKey].push(colNumber);
        console.log(`[HEADERS] ✅ Matched "${headerValue}" to ${normalizedKey} (column ${colNumber})`);
        break;
      }
    }
  });
  
  // Second pass: for each field type, find the first column that has data
  const fieldTypes = ['description_sv', 'description_html_sv', 'seo_title_sv', 'seo_description_sv'];
  
  for (const fieldType of fieldTypes) {
    if (matchingColumns[fieldType]) {
      console.log(`[HEADERS] Found ${matchingColumns[fieldType].length} ${fieldType} columns:`, matchingColumns[fieldType]);
      
      // Check each column to see which one has data
      for (const colNumber of matchingColumns[fieldType]) {
        const hasData = checkColumnHasData(worksheet, colNumber);
        console.log(`[HEADERS] Column ${colNumber} has data:`, hasData);
        
        if (hasData) {
          headers[fieldType] = colNumber;
          console.log(`[HEADERS] ✅ Selected column ${colNumber} for ${fieldType} (has data)`);
          break;
        }
      }
      // IMPORTANT: If no column has data for this field type, do NOT set a header at all.
      // This prevents accidental fallbacks that would display values that do not exist in the import file.
    }
  }
  
  // For other columns, use the first match, but DO NOT set optional text fields
  // if we didn't detect actual data above (description_html_sv, seo_title_sv, seo_description_sv).
  const optionalTextFields = new Set(['description_html_sv', 'seo_title_sv', 'seo_description_sv']);
  for (const [normalizedKey, columns] of Object.entries(matchingColumns)) {
    if (normalizedKey === 'description_sv') continue;
    if (optionalTextFields.has(normalizedKey)) continue; // handled above only when data exists
    if (columns.length > 0) {
      headers[normalizedKey] = columns[0];
    }
  }
  
  console.log('[HEADERS] Final normalized headers:', headers);
  return headers;
}

function checkColumnHasData(worksheet: ExcelJS.Worksheet, colNumber: number): boolean {
  let hasData = false;
  let rowCount = 0;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    rowCount++;
    // Check more rows to avoid missing sparse columns (previously only 10)
    if (rowCount > 200) return; // Safety limit
    
    const cell = row.getCell(colNumber);
    const value = String(cell.value || '').trim();
    
    if (value && value.length > 0) {
      hasData = true;
      console.log(`[HEADERS] Found data in column ${colNumber}, row ${rowNumber}: "${value.substring(0, 50)}..."`);
    }
  });
  
  return hasData;
}

function getAllHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  
  headerRow.eachCell((cell, colNumber) => {
    const headerValue = String(cell.value || '').trim();
    if (headerValue) {
      headers.push(headerValue);
    }
  });
  
  return headers;
}

function detectLanguagePatterns(headers: string[]): string[] {
  const detectedLanguages: string[] = [];
  const languagePattern = /^description_([a-z]{2})$/i;
  
  for (const header of headers) {
    const match = header.match(languagePattern);
    if (match) {
      const langCode = match[1].toLowerCase();
      if (!detectedLanguages.includes(langCode)) {
        detectedLanguages.push(langCode);
      }
    }
  }
  
  return detectedLanguages.sort();
}

function suggestOriginalLanguage(headers: string[], detectedLanguages: string[]): string | undefined {
  // Priority order for original language detection
  const originalLanguagePriority = ['sv', 'se', 'sv-se', 'sv_se'];
  
  // First, check for explicit original language patterns
  for (const priority of originalLanguagePriority) {
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes(`description_${priority}`) || 
          lowerHeader.includes(`name_${priority}`) ||
          lowerHeader.includes(`_${priority}_`)) {
        return priority.split(/[-_]/)[0]; // Return just the language code part
      }
    }
  }
  
  // If no explicit original language found, suggest the first detected language
  // that's not in the common translation languages
  const commonTranslationLanguages = ['da', 'no', 'en', 'de', 'fr', 'es'];
  for (const lang of detectedLanguages) {
    if (!commonTranslationLanguages.includes(lang)) {
      return lang;
    }
  }
  
  // Default to Swedish if found
  if (detectedLanguages.includes('sv')) {
    return 'sv';
  }
  
  // Return the first detected language as fallback
  return detectedLanguages.length > 0 ? detectedLanguages[0] : undefined;
}

function validateRequiredColumns(headers: Record<string, number>, jobType: 'product_texts' | 'ui_strings' | 'brands' = 'product_texts'): void {
  const requiredColumns = REQUIRED_COLUMNS[jobType] || [];
  const missingColumns = requiredColumns.filter(col => !(col in headers));
  
  console.log(`[VALIDATE] Required columns for ${jobType}:`, requiredColumns);
  console.log(`[VALIDATE] Found headers:`, Object.keys(headers));
  console.log(`[VALIDATE] Missing columns:`, missingColumns);
  
  if (missingColumns.length > 0) {
    console.error(`[VALIDATE] ❌ Missing required columns: ${missingColumns.join(', ')}`);
    throw new NormalizationError(
      `Missing required columns: ${missingColumns.join(', ')}`
    );
  }
  
  console.log(`[VALIDATE] ✅ All required columns found`);
}

function isEmptyRow(row: ExcelJS.Row): boolean {
  let hasContent = false;
  row.eachCell((cell) => {
    if (cell.value && String(cell.value).trim()) {
      hasContent = true;
    }
  });
  return !hasContent;
}

function parseProductRow(row: ExcelJS.Row, headers: Record<string, number>): Product | null {
  const name_sv = getCellValue(row, headers.name_sv);
  const description_sv = headers.description_sv ? getCellValue(row, headers.description_sv) : '';
  const description_html_sv = headers.description_html_sv ? getCellValue(row, headers.description_html_sv) : '';
  const seo_title_sv = headers.seo_title_sv ? getCellValue(row, headers.seo_title_sv) : '';
  const seo_description_sv = headers.seo_description_sv ? getCellValue(row, headers.seo_description_sv) : '';
  
  console.log(`[PARSE] Row ${row.number}: name_sv="${name_sv}", description_sv="${description_sv}", description_html_sv="${description_html_sv}"`);
  
  if (!name_sv) {
    console.log(`[PARSE] Row ${row.number}: Missing required field - name_sv: ${!!name_sv}`);
    return null;
  }
  
  const attributes = headers.attributes ? getCellValue(row, headers.attributes) : undefined;
  const tone_hint = headers.tone_hint ? getCellValue(row, headers.tone_hint) : undefined;
  
  // Collect all raw data from the row
  const rawData: Record<string, any> = {};
  row.eachCell((cell, colNumber) => {
    const headerValue = getHeaderValue(row.worksheet, colNumber);
    if (headerValue) {
      rawData[headerValue] = cell.value || '';
    }
  });
  
  return {
    name_sv: name_sv.trim(),
    description_sv: truncateDescription(description_sv.trim()),
    description_html_sv: description_html_sv ? truncateDescription(description_html_sv.trim()) : undefined,
    seo_title_sv: seo_title_sv ? seo_title_sv.trim() : undefined,
    seo_description_sv: seo_description_sv ? truncateDescription(seo_description_sv.trim()) : undefined,
    attributes: attributes?.trim(),
    tone_hint: tone_hint?.trim(),
    raw_data: rawData,
  };
}

function getCellValue(row: ExcelJS.Row, colNumber: number): string {
  const cell = row.getCell(colNumber);
  return String(cell.value || '');
}

function getHeaderValue(worksheet: ExcelJS.Worksheet, colNumber: number): string {
  const headerRow = worksheet.getRow(1);
  const cell = headerRow.getCell(colNumber);
  return String(cell.value || '').trim();
}

function truncateDescription(description: string): string {
  if (description.length <= MAX_DESCRIPTION_LENGTH) {
    return description;
  }
  
  // Truncate to ~4000 chars, trying to break at word boundary
  const truncated = description.substring(0, MAX_DESCRIPTION_LENGTH);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > MAX_DESCRIPTION_LENGTH * 0.9) {
    return truncated.substring(0, lastSpaceIndex);
  }
  
  return truncated;
}

function getUIStringHeaders(worksheet: ExcelJS.Worksheet): { name: number; locales: string[]; localeColumns: Record<string, number> } {
  const headerRow = worksheet.getRow(1);
  const headers: { name: number; locales: string[]; localeColumns: Record<string, number> } = {
    name: 0,
    locales: [],
    localeColumns: {}
  };
  
  headerRow.eachCell((cell, colNumber) => {
    const headerValue = String(cell.value || '').trim();
    
    if (headerValue.toLowerCase() === 'name') {
      headers.name = colNumber;
    } else if (/^[a-z]{2}-[a-zA-Z]{2}$/.test(headerValue)) {
      headers.locales.push(headerValue);
      headers.localeColumns[headerValue] = colNumber;
    }
  });
  
  return headers;
}

function validateUIStringColumns(headers: { name: number; locales: string[]; localeColumns: Record<string, number> }): void {
  if (headers.name === 0) {
    throw new NormalizationError('Missing required column: Name');
  }
  
  if (headers.locales.length === 0) {
    throw new NormalizationError('No locale columns found (expected format: en-US, sv-SE, no-NO, etc.)');
  }
}

function parseUIStringRow(row: ExcelJS.Row, headers: { name: number; locales: string[]; localeColumns: Record<string, number> }): UIString | null {
  const name = getCellValue(row, headers.name);
  
  if (!name || !name.trim()) {
    return null;
  }
  
  const values: Record<string, string> = {};
  
  for (const locale of headers.locales) {
    const colNumber = headers.localeColumns[locale];
    const value = getCellValue(row, colNumber);
    values[locale] = value || ''; // Allow empty values
  }
  
  return {
    name: name.trim(),
    values,
  };
}

// TODO: Litium-specifika alias för kolumnmappning
// TODO: Parsa attributes till strukturerat objekt

async function normalizeBrands(worksheet: ExcelJS.Worksheet): Promise<NormalizeResult> {
  // Get exact headers in original order
  const exactHeaders = getAllHeaders(worksheet);
  
  // Extract tokens from all column headers
  let extractedTokens;
  try {
    extractedTokens = extractTokens(exactHeaders);
  } catch (error) {
    console.warn('Failed to extract tokens:', error);
    extractedTokens = { tokens: [], systemTokens: [] };
  }

  // Detect language patterns in headers
  const detectedLanguages = detectLanguagePatterns(exactHeaders);
  const suggestedOriginalLanguage = suggestOriginalLanguage(exactHeaders, detectedLanguages);
  
  const brands: Brand[] = [];
  let skipped = 0;
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    if (isEmptyRow(row)) {
      skipped++;
      return;
    }
    
    const brand = parseBrandRowWithExactHeaders(row, exactHeaders);
    if (brand) {
      brands.push(brand);
    }
  });

  return {
    brands,
    meta: {
      rows: brands.length,
      skipped,
      tokens: extractedTokens,
      detectedLanguages,
      suggestedOriginalLanguage,
      headers: exactHeaders, // Store exact headers for UI
    },
  };
}

function parseBrandRowWithExactHeaders(row: ExcelJS.Row, exactHeaders: string[]): Brand | null {
  // Collect all raw data from the row using exact headers
  const rawData: Record<string, any> = {};
  let hasContent = false;
  
  exactHeaders.forEach((header, index) => {
    const colNumber = index + 1; // Excel columns are 1-based
    const cell = row.getCell(colNumber);
    const cellValue = cell.value || '';
    rawData[header] = cellValue;
    
    if (cellValue && String(cellValue).trim()) {
      hasContent = true;
    }
  });
  
  if (!hasContent) {
    return null; // Skip empty rows
  }
  
  // Try to find name and description from any available columns
  let name_sv = '';
  let description_sv = '';
  
  // Look for common name/description patterns in headers
  for (const [header, value] of Object.entries(rawData)) {
    const lowerHeader = header.toLowerCase();
    const stringValue = String(value).trim();
    
    if (stringValue && (lowerHeader.includes('name') || lowerHeader.includes('namn') || lowerHeader.includes('titel'))) {
      name_sv = stringValue;
    }
    if (stringValue && (lowerHeader.includes('description') || lowerHeader.includes('beskrivning') || lowerHeader.includes('text'))) {
      description_sv = stringValue;
    }
  }
  
  // If we can't find name/description, use the first two non-empty cells
  if (!name_sv || !description_sv) {
    const cellValues = Object.values(rawData)
      .map(v => String(v).trim())
      .filter(v => v);
    
    name_sv = name_sv || cellValues[0] || 'Unnamed Brand';
    description_sv = description_sv || cellValues[1] || cellValues[0] || '';
  }
  
  return {
    name_sv: name_sv.trim(),
    description_sv: truncateDescription(description_sv.trim()),
    attributes: undefined, // Not used for brands
    tone_hint: undefined, // Not used for brands
    raw_data: rawData, // Contains all original Excel data with exact headers
  };
}

function parseBrandRow(row: ExcelJS.Row, headers: Record<string, number>): Brand | null {
  // For brands, we don't require specific columns - use whatever is available
  // Try to find any name-like and description-like columns
  let name_sv = '';
  let description_sv = '';
  
  // Look for common name/description patterns in headers
  for (const [headerName, colNumber] of Object.entries(headers)) {
    const lowerHeader = headerName.toLowerCase();
    if (lowerHeader.includes('name') || lowerHeader.includes('namn') || lowerHeader.includes('titel')) {
      name_sv = getCellValue(row, colNumber) || '';
    }
    if (lowerHeader.includes('description') || lowerHeader.includes('beskrivning') || lowerHeader.includes('text')) {
      description_sv = getCellValue(row, colNumber) || '';
    }
  }
  
  // If we can't find name/description, use the first two non-empty cells
  if (!name_sv || !description_sv) {
    const cellValues: string[] = [];
    row.eachCell((cell, colNumber) => {
      if (cell.value && String(cell.value).trim()) {
        cellValues.push(String(cell.value).trim());
      }
    });
    
    if (cellValues.length === 0) {
      return null; // Skip empty rows
    }
    
    name_sv = name_sv || cellValues[0] || 'Unnamed Brand';
    description_sv = description_sv || cellValues[1] || cellValues[0] || '';
  }
  
  const attributes = headers.attributes ? getCellValue(row, headers.attributes) : undefined;
  const tone_hint = headers.tone_hint ? getCellValue(row, headers.tone_hint) : undefined;
  
  // Collect all raw data from the row
  const rawData: Record<string, any> = {};
  row.eachCell((cell, colNumber) => {
    const headerValue = getHeaderValue(row.worksheet, colNumber);
    if (headerValue) {
      rawData[headerValue] = cell.value || '';
    }
  });
  
  // Add original row number to preserve order
  rawData['__original_row_number__'] = row.number;
  
  return {
    name_sv: name_sv.trim(),
    description_sv: truncateDescription(description_sv.trim()),
    attributes: attributes?.trim(),
    tone_hint: tone_hint?.trim(),
    raw_data: rawData,
  };
}
