import * as ExcelJS from 'exceljs';

export interface Product {
  name_sv: string;
  description_sv: string;
  attributes?: string;
  tone_hint?: string;
}

export interface NormalizeResult {
  products: Product[];
  meta: {
    rows: number;
    skipped: number;
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

export async function normalize(buffer: Buffer | ArrayBuffer): Promise<NormalizeResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    // Convert to Buffer if needed and use any to bypass type issues
    const bufferData = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    await workbook.xlsx.load(bufferData as any);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new NormalizationError('Invalid workbook');
    }

    const headers = getNormalizedHeaders(worksheet);
    validateRequiredColumns(headers);
    
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
      },
    };
  } catch (error) {
    if (error instanceof NormalizationError) {
      throw error;
    }
    throw new NormalizationError('Invalid workbook');
  }
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
  
  return {
    name_sv: name_sv.trim(),
    description_sv: truncateDescription(description_sv.trim()),
    attributes: attributes?.trim(),
    tone_hint: tone_hint?.trim(),
  };
}

function getCellValue(row: ExcelJS.Row, colNumber: number): string {
  const cell = row.getCell(colNumber);
  return String(cell.value || '');
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

// TODO: Litium-specifika alias för kolumnmappning
// TODO: Parsa attributes till strukturerat objekt
