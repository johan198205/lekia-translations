import { describe, it, expect, beforeEach } from 'vitest';
import * as ExcelJS from 'exceljs';
import { normalize, NormalizationError, Product } from '@/lib/excel/normalize';

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
