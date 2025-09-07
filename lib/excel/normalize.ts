import * as ExcelJS from 'exceljs';
import { extractTokens, ExtractedTokens } from '@/lib/token-extractor';

export interface Product {
  name_sv: string;
  description_sv: string;
  attributes?: string;
  tone_hint?: string;
  raw_data?: Record<string, any>; // All original Excel columns
}

export interface UIString {
  name: string;
  values: Record<string, string>;
}

export interface NormalizeResult {
  products?: Product[];
  uiStrings?: UIString[];
  meta: {
    rows: number;
    skipped: number;
    locales?: string[];
    tokens?: ExtractedTokens;
    detectedLanguages?: string[];
    suggestedOriginalLanguage?: string;
  };
}

const HEADER_ALIASES = {
  name_sv: ['product_name_sv', 'name_sv', 'product_name', 'name'],
  description_sv: ['description_sv', 'description', 'product_description'],
  attributes: ['attributes', 'spec', 'specification', 'specs'],
  tone_hint: ['tone_hint', 'tone', 'style'],
} as const;

const REQUIRED_COLUMNS = ['name_sv', 'description_sv'] as const;
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
  validateRequiredColumns(headers);
  
  // Extract tokens from all column headers
  const allHeaders = getAllHeaders(worksheet);
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
    if (product) {
      products.push(product);
    }
  });

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

  return {
    uiStrings,
    meta: {
      rows: uiStrings.length,
      skipped,
      locales: headers.locales,
    },
  };
}

function getNormalizedHeaders(worksheet: ExcelJS.Worksheet): Record<string, number> {
  const headerRow = worksheet.getRow(1);
  const headers: Record<string, number> = {};
  
  headerRow.eachCell((cell, colNumber) => {
    const headerValue = String(cell.value || '').trim().toLowerCase();
    
    for (const [normalizedKey, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(alias => alias.toLowerCase() === headerValue)) {
        headers[normalizedKey] = colNumber;
        break;
      }
    }
  });
  
  return headers;
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

function validateRequiredColumns(headers: Record<string, number>): void {
  const missingColumns = REQUIRED_COLUMNS.filter(col => !(col in headers));
  
  if (missingColumns.length > 0) {
    throw new NormalizationError(
      `Missing required columns: ${missingColumns.join(', ')}`
    );
  }
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
  const description_sv = getCellValue(row, headers.description_sv);
  
  if (!name_sv || !description_sv) {
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
    } else if (/^[a-z]{2}-[A-Z]{2}$/.test(headerValue)) {
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
