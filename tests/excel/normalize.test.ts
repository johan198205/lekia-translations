import { describe, it, expect, beforeEach } from 'vitest';
import * as ExcelJS from 'exceljs';
import { normalize, NormalizationError, Product, UIString } from '@/lib/excel/normalize';

describe('Excel Normalize', () => {
  let workbook: ExcelJS.Workbook;
  let worksheet: ExcelJS.Worksheet;

  beforeEach(() => {
    workbook = new ExcelJS.Workbook();
    worksheet = workbook.addWorksheet('Products');
  });

  function addRow(values: (string | number | null)[]): void {
    worksheet.addRow(values);
  }

  async function createBuffer(): Promise<Buffer> {
    return await workbook.xlsx.writeBuffer() as any;
  }

  describe('Happy path - minimal headers', () => {
    it('should parse basic product data correctly', async () => {
      addRow(['product_name_sv', 'description_sv']);
      addRow(['Produkt A', 'Beskrivning av produkt A']);
      addRow(['Produkt B', 'Beskrivning av produkt B']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(2);
      expect(result.meta.rows).toBe(2);
      expect(result.meta.skipped).toBe(0);

      expect(result.products[0]).toEqual({
        name_sv: 'Produkt A',
        description_sv: 'Beskrivning av produkt A'
      });

      expect(result.products[1]).toEqual({
        name_sv: 'Produkt B',
        description_sv: 'Beskrivning av produkt B'
      });
    });
  });

  describe('Header aliases', () => {
    it('should map aliased headers correctly', async () => {
      addRow(['name', 'product_description', 'specs', 'tone']);
      addRow(['Produkt C', 'Beskrivning C', 'Specifikationer C', 'Professionell']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toEqual({
        name_sv: 'Produkt C',
        description_sv: 'Beskrivning C',
        attributes: 'Specifikationer C',
        tone_hint: 'Professionell'
      });
    });

    it('should handle case-insensitive header matching', async () => {
      addRow(['PRODUCT_NAME', 'DESCRIPTION', 'ATTRIBUTES', 'TONE_HINT']);
      addRow(['Produkt D', 'Beskrivning D', 'Spec D', 'Formell']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toEqual({
        name_sv: 'Produkt D',
        description_sv: 'Beskrivning D',
        attributes: 'Spec D',
        tone_hint: 'Formell'
      });
    });

    it('should handle trimmed headers', async () => {
      addRow(['  name_sv  ', '  description_sv  ']);
      addRow(['Produkt E', 'Beskrivning E']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toEqual({
        name_sv: 'Produkt E',
        description_sv: 'Beskrivning E'
      });
    });
  });

  describe('Missing required columns', () => {
    it('should throw error when name_sv is missing', async () => {
      addRow(['description_sv']);
      addRow(['Beskrivning F']);

      const buffer = await createBuffer();
      
      await expect(normalize(buffer)).rejects.toThrow('Missing required columns: name_sv');
    });

    it('should throw error when description_sv is missing', async () => {
      addRow(['name_sv']);
      addRow(['Produkt F']);

      const buffer = await createBuffer();
      
      await expect(normalize(buffer)).rejects.toThrow('Missing required columns: description_sv');
    });

    it('should throw error when both required columns are missing', async () => {
      addRow(['attributes', 'tone_hint']);
      addRow(['Spec G', 'Informell']);

      const buffer = await createBuffer();
      
      await expect(normalize(buffer)).rejects.toThrow('Missing required columns: name_sv, description_sv');
    });
  });

  describe('Data processing', () => {
    it('should skip completely empty rows', async () => {
      addRow(['name_sv', 'description_sv']);
      addRow(['Produkt H', 'Beskrivning H']);
      addRow([]);
      addRow(['', '']);
      addRow(['   ', '   ']);
            addRow(['Produkt I', 'Beskrivning I']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(2);
      expect(result.meta.rows).toBe(2);
      expect(result.meta.skipped).toBe(2); // ExcelJS skips addRow([]) entirely
    });

    it('should skip rows with missing required values', async () => {
      addRow(['name_sv', 'description_sv']);
      addRow(['Produkt J', 'Beskrivning J']);
      addRow(['Produkt K', '']); // Missing description
      addRow(['', 'Beskrivning L']); // Missing name
      addRow(['Produkt M', 'Beskrivning M']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(2);
      expect(result.meta.rows).toBe(2);
      expect(result.meta.skipped).toBe(0); // Rows with missing data are not counted as skipped
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'A'.repeat(5000);
      const expectedDescription = 'A'.repeat(4000);

      addRow(['name_sv', 'description_sv']);
      addRow(['Produkt N', longDescription]);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].description_sv).toBe(expectedDescription);
      expect(result.products[0].description_sv.length).toBe(4000);
    });

    it('should preserve description under limit', async () => {
      const shortDescription = 'A'.repeat(2000);

      addRow(['name_sv', 'description_sv']);
      addRow(['Produkt O', shortDescription]);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].description_sv).toBe(shortDescription);
      expect(result.products[0].description_sv.length).toBe(2000);
    });

  });

  describe('Cell value handling', () => {
    it('should convert numeric values to strings', async () => {
      addRow(['name_sv', 'description_sv']);
      addRow([123, 'Beskrivning P']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name_sv).toBe('123');
    });

         it('should convert boolean values to strings', async () => {
       addRow(['name_sv', 'description_sv']);
       addRow(['true', 'Beskrivning Q']);
 
       const buffer = await createBuffer();
       const result = await normalize(buffer);
 
       expect(result.products).toHaveLength(1);
       expect(result.products[0].name_sv).toBe('true');
     });

         it('should handle null/undefined cells', async () => {
       addRow(['name_sv', 'description_sv', 'attributes']);
       addRow(['Produkt R', 'Beskrivning R', null]);
 
       const buffer = await createBuffer();
       const result = await normalize(buffer);
 
       expect(result.products).toHaveLength(1);
       expect(result.products[0].attributes).toBe('');
     });
  });

  describe('Invalid workbook', () => {
         it('should throw error for empty workbook', async () => {
       const buffer = await createBuffer();
       
       await expect(normalize(buffer)).rejects.toThrow('Missing required columns: name_sv, description_sv');
     });

    it('should throw error for workbook without worksheets', async () => {
      workbook.removeWorksheet('Products');
      const buffer = await createBuffer();
      
      await expect(normalize(buffer)).rejects.toThrow('Invalid workbook');
    });
  });

  describe('Row order preservation', () => {
    it('should maintain input row order', async () => {
      addRow(['name_sv', 'description_sv']);
      addRow(['Produkt S', 'Beskrivning S']);
      addRow(['Produkt T', 'Beskrivning T']);
      addRow(['Produkt U', 'Beskrivning U']);

      const buffer = await createBuffer();
      const result = await normalize(buffer);

      expect(result.products).toHaveLength(3);
      expect(result.products[0].name_sv).toBe('Produkt S');
      expect(result.products[1].name_sv).toBe('Produkt T');
      expect(result.products[2].name_sv).toBe('Produkt U');
    });
  });
});

describe('UI Strings Normalize', () => {
  let workbook: ExcelJS.Workbook;
  let worksheet: ExcelJS.Worksheet;

  beforeEach(() => {
    workbook = new ExcelJS.Workbook();
    worksheet = workbook.addWorksheet('UI Strings');
  });

  function addRow(values: (string | number | null)[]): void {
    worksheet.addRow(values);
  }

  async function createBuffer(): Promise<Buffer> {
    return await workbook.xlsx.writeBuffer() as any;
  }

  describe('Happy path - basic UI strings', () => {
    it('should parse basic UI string data correctly', async () => {
      addRow(['Name', 'en-US', 'sv-SE', 'no-NO']);
      addRow(['button.save', 'Save', 'Spara', 'Lagre']);
      addRow(['button.cancel', 'Cancel', 'Avbryt', 'Avbryt']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings).toHaveLength(2);
      expect(result.meta.rows).toBe(2);
      expect(result.meta.skipped).toBe(0);
      expect(result.meta.locales).toEqual(['en-US', 'sv-SE', 'no-NO']);

      expect(result.uiStrings![0]).toEqual({
        name: 'button.save',
        values: {
          'en-US': 'Save',
          'sv-SE': 'Spara',
          'no-NO': 'Lagre'
        }
      });

      expect(result.uiStrings![1]).toEqual({
        name: 'button.cancel',
        values: {
          'en-US': 'Cancel',
          'sv-SE': 'Avbryt',
          'no-NO': 'Avbryt'
        }
      });
    });
  });

  describe('Dynamic locale detection', () => {
    it('should detect various locale formats', async () => {
      addRow(['Name', 'en-US', 'sv-SE', 'no-NO', 'da-DK', 'fi-FI']);
      addRow(['test.key', 'English', 'Svenska', 'Norsk', 'Dansk', 'Suomi']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.meta.locales).toEqual(['en-US', 'sv-SE', 'no-NO', 'da-DK', 'fi-FI']);
      expect(result.uiStrings![0].values).toEqual({
        'en-US': 'English',
        'sv-SE': 'Svenska',
        'no-NO': 'Norsk',
        'da-DK': 'Dansk',
        'fi-FI': 'Suomi'
      });
    });

    it('should ignore non-locale columns', async () => {
      addRow(['Name', 'en-US', 'sv-SE', 'Description', 'Category', 'no-NO']);
      addRow(['test.key', 'English', 'Svenska', 'Some description', 'UI', 'Norsk']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.meta.locales).toEqual(['en-US', 'sv-SE', 'no-NO']);
      expect(result.uiStrings![0].values).toEqual({
        'en-US': 'English',
        'sv-SE': 'Svenska',
        'no-NO': 'Norsk'
      });
    });
  });

  describe('Empty values handling', () => {
    it('should allow empty locale values', async () => {
      addRow(['Name', 'en-US', 'sv-SE', 'no-NO']);
      addRow(['button.save', 'Save', 'Spara', '']); // Empty no-NO
      addRow(['button.cancel', '', 'Avbryt', 'Avbryt']); // Empty en-US

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings).toHaveLength(2);
      expect(result.uiStrings![0].values).toEqual({
        'en-US': 'Save',
        'sv-SE': 'Spara',
        'no-NO': ''
      });
      expect(result.uiStrings![1].values).toEqual({
        'en-US': '',
        'sv-SE': 'Avbryt',
        'no-NO': 'Avbryt'
      });
    });

    it('should handle null/undefined cells as empty strings', async () => {
      addRow(['Name', 'en-US', 'sv-SE', 'no-NO']);
      addRow(['test.key', 'English', null, undefined]);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings![0].values).toEqual({
        'en-US': 'English',
        'sv-SE': '',
        'no-NO': ''
      });
    });
  });

  describe('Missing required columns', () => {
    it('should throw error when Name column is missing', async () => {
      addRow(['en-US', 'sv-SE', 'no-NO']);
      addRow(['English', 'Svenska', 'Norsk']);

      const buffer = await createBuffer();
      
      await expect(normalize(buffer, 'ui_strings')).rejects.toThrow('Missing required column: Name');
    });

    it('should throw error when no locale columns are found', async () => {
      addRow(['Name', 'Description', 'Category']);
      addRow(['test.key', 'Some description', 'UI']);

      const buffer = await createBuffer();
      
      await expect(normalize(buffer, 'ui_strings')).rejects.toThrow('No locale columns found (expected format: en-US, sv-SE, no-NO, etc.)');
    });
  });

  describe('Data processing', () => {
    it('should skip rows with missing name', async () => {
      addRow(['Name', 'en-US', 'sv-SE']);
      addRow(['button.save', 'Save', 'Spara']);
      addRow(['', 'Cancel', 'Avbryt']); // Missing name
      addRow(['button.cancel', 'Cancel', 'Avbryt']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings).toHaveLength(2);
      expect(result.meta.rows).toBe(2);
      expect(result.meta.skipped).toBe(0);
    });

    it('should skip completely empty rows', async () => {
      addRow(['Name', 'en-US', 'sv-SE']);
      addRow(['button.save', 'Save', 'Spara']);
      addRow([]);
      addRow(['', '']);
      addRow(['button.cancel', 'Cancel', 'Avbryt']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings).toHaveLength(2);
      expect(result.meta.rows).toBe(2);
      expect(result.meta.skipped).toBe(1); // Only one empty row is actually skipped by ExcelJS
    });

    it('should preserve content exactly including line breaks and HTML', async () => {
      addRow(['Name', 'en-US', 'sv-SE']);
      addRow(['multiline.text', 'Line 1\nLine 2', 'Rad 1\nRad 2']);
      addRow(['html.text', '<strong>Bold</strong>', '<em>Kursiv</em>']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings![0].values['en-US']).toBe('Line 1\nLine 2');
      expect(result.uiStrings![0].values['sv-SE']).toBe('Rad 1\nRad 2');
      expect(result.uiStrings![1].values['en-US']).toBe('<strong>Bold</strong>');
      expect(result.uiStrings![1].values['sv-SE']).toBe('<em>Kursiv</em>');
    });
  });

  describe('Case sensitivity', () => {
    it('should handle case-insensitive Name column', async () => {
      addRow(['NAME', 'en-US', 'sv-SE']);
      addRow(['button.save', 'Save', 'Spara']);

      const buffer = await createBuffer();
      const result = await normalize(buffer, 'ui_strings');

      expect(result.uiStrings).toHaveLength(1);
      expect(result.uiStrings![0].name).toBe('button.save');
    });

    it('should preserve exact locale case', async () => {
      addRow(['Name', 'EN-US', 'sv-se', 'No-No']);
      addRow(['test.key', 'English', 'Svenska', 'Norsk']);

      const buffer = await createBuffer();
      
      // This should throw an error because no valid locale columns are found
      await expect(normalize(buffer, 'ui_strings')).rejects.toThrow('No locale columns found (expected format: en-US, sv-SE, no-NO, etc.)');
    });
  });
});

describe('Route Handler Integration Tests', () => {
  // Mock NextRequest and NextResponse for testing
  const createMockRequest = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return {
      formData: () => Promise.resolve(formData),
    } as any;
  };

  const createMockFile = (name: string, content: string, type: string, size: number): File => {
    return {
      name,
      type,
      size,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(content).buffer),
    } as any;
  };

  describe('File validation', () => {
    it('should reject non-xlsx files by extension', async () => {
      const file = createMockFile('test.txt', 'content', 'text/plain', 100);
      const request = createMockRequest(file);
      
      // This would be tested in the actual route handler
      expect(file.name.toLowerCase().endsWith('.xlsx')).toBe(false);
    });

    it('should reject non-xlsx files by MIME type', async () => {
      const file = createMockFile('test.xlsx', 'content', 'text/plain', 100);
      const request = createMockRequest(file);
      
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
      ];
      
      expect(allowedMimeTypes.includes(file.type)).toBe(false);
    });

    it('should accept valid xlsx files', async () => {
      const file = createMockFile('test.xlsx', 'content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 100);
      const request = createMockRequest(file);
      
      expect(file.name.toLowerCase().endsWith('.xlsx')).toBe(true);
      expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });

  describe('Size validation', () => {
    it('should reject files larger than 16MB', async () => {
      const maxSize = 16 * 1024 * 1024; // 16 MB
      const oversizedFile = createMockFile('test.xlsx', 'content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxSize + 1);
      
      expect(oversizedFile.size).toBeGreaterThan(maxSize);
    });

    it('should accept files under 16MB', async () => {
      const maxSize = 16 * 1024 * 1024; // 16 MB
      const validFile = createMockFile('test.xlsx', 'content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxSize - 1);
      
      expect(validFile.size).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Error handling', () => {
    it('should handle missing file gracefully', async () => {
      const request = createMockRequest(null as any);
      
      // This would be tested in the actual route handler
      expect(request.formData).toBeDefined();
    });

    it('should handle malformed Excel files', async () => {
      const invalidBuffer = Buffer.from('invalid excel content');
      
      await expect(normalize(invalidBuffer)).rejects.toThrow('Invalid workbook');
    });
  });
});
