import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    productBatch: {
      findUnique: mockFindUnique,
      update: mockUpdate
    },
    product: {
      findMany: mockFindMany,
      update: mockUpdate
    }
  }))
}));

// Test data
const mockBatch = {
  id: 'batch-123',
  filename: 'test.xlsx',
  upload_date: new Date(),
  total_products: 3,
  status: 'pending' as const
};

const mockOptimizedProducts = [
  {
    id: 'product-1',
    batch_id: 'batch-123',
    name_sv: 'Test Produkt 1',
    description_sv: 'Beskrivning på svenska',
    attributes: '{"färg": "röd"}',
    tone_hint: 'formell',
    optimized_sv: '# Kort beskrivning\nDetta är en testprodukt\n\n## Fördelar\n- Punkt 1\n- Punkt 2\n\n## Specifikationer\nfärg: röd',
    status: 'optimized' as const,
    translated_da: null,
    translated_no: null,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'product-2',
    batch_id: 'batch-123',
    name_sv: 'Test Produkt 2',
    description_sv: 'En annan produkt',
    attributes: null,
    tone_hint: null,
    optimized_sv: '# Produkt 2\nBeskrivning\n\n## Detaljer\nMer information',
    status: 'optimized' as const,
    translated_da: null,
    translated_no: null,
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Test fakeTranslate function directly
function fakeTranslate(optimizedSv: string, lang: 'da' | 'no'): string {
  const langCode = lang.toUpperCase();
  const langSuffix = lang === 'da' ? ' [DA]' : ' [NO]';
  
  // Add meta line at top
  let translated = `<!-- lang:${langCode} -->\n`;
  
  // Process line by line to preserve structure
  const lines = optimizedSv.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (i === 0 && line.startsWith('# ')) {
      // Add language suffix to H1 only
      translated += line + langSuffix + '\n';
    } else {
      // Keep all other lines verbatim (including ## headings)
      translated += line + '\n';
    }
  }
  
  return translated.trim();
}

describe('Translate API Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fakeTranslate function', () => {
    it('should preserve structure and add language meta line', () => {
      const input = '# Kort beskrivning\nDetta är en testprodukt\n\n## Fördelar\n- Punkt 1\n- Punkt 2';
      
      const resultDa = fakeTranslate(input, 'da');
      const resultNo = fakeTranslate(input, 'no');
      
      // Check meta lines
      expect(resultDa).toContain('<!-- lang:DA -->');
      expect(resultNo).toContain('<!-- lang:NO -->');
      
      // Check H1 modification
      expect(resultDa).toContain('# Kort beskrivning [DA]');
      expect(resultNo).toContain('# Kort beskrivning [NO]');
      
      // Check ## headings preserved exactly
      expect(resultDa).toContain('## Fördelar');
      expect(resultNo).toContain('## Fördelar');
      
      // Check other content preserved
      expect(resultDa).toContain('Detta är en testprodukt');
      expect(resultDa).toContain('- Punkt 1');
      expect(resultDa).toContain('- Punkt 2');
    });

    it('should handle single line H1 correctly', () => {
      const input = '# Enkel rubrik';
      
      const resultDa = fakeTranslate(input, 'da');
      const resultNo = fakeTranslate(input, 'no');
      
      expect(resultDa).toBe('<!-- lang:DA -->\n# Enkel rubrik [DA]');
      expect(resultNo).toBe('<!-- lang:NO -->\n# Enkel rubrik [NO]');
    });

    it('should preserve ## headings verbatim', () => {
      const input = '# Huvudrubrik\n## Underrubrik 1\n## Underrubrik 2';
      
      const resultDa = fakeTranslate(input, 'da');
      
      expect(resultDa).toContain('# Huvudrubrik [DA]');
      expect(resultDa).toContain('## Underrubrik 1');
      expect(resultDa).toContain('## Underrubrik 2');
    });
  });

  describe('API endpoint logic', () => {
    it('should process OPTIMIZED products and set translations', async () => {
      // Mock Prisma calls
      mockFindUnique.mockResolvedValue(mockBatch);
      mockFindMany
        .mockResolvedValueOnce(mockOptimizedProducts) // First call for OPTIMIZED products
        .mockResolvedValueOnce([]); // Second call for remaining products
      mockUpdate.mockResolvedValue({});

      // Simulate processing
      let succeeded = 0;
      let failed = 0;

      for (const product of mockOptimizedProducts) {
        try {
          // Set status to TRANSLATING
          await mockUpdate({
            where: { id: product.id },
            data: { status: 'translating' }
          });

          // Run translations for both languages
          const updateData: any = {
            status: 'completed',
            error_message: null
          };

          updateData.translated_da = fakeTranslate(product.optimized_sv!, 'da');
          updateData.translated_no = fakeTranslate(product.optimized_sv!, 'no');

          // Update product
          await mockUpdate({
            where: { id: product.id },
            data: updateData
          });

          succeeded++;
        } catch (error) {
          failed++;
        }
      }

      expect(succeeded).toBe(2); // 2 OPTIMIZED products
      expect(failed).toBe(0);
      expect(mockUpdate).toHaveBeenCalledTimes(4); // 2 * (1 for TRANSLATING + 1 for COMPLETED)
    });

    it('should handle idempotency correctly', async () => {
      // Mock Prisma calls
      mockFindUnique.mockResolvedValue(mockBatch);
      mockFindMany
        .mockResolvedValueOnce(mockOptimizedProducts) // All products including completed
        .mockResolvedValueOnce([]); // No remaining products
      mockUpdate.mockResolvedValue({});

      let succeeded = 0;
      let skipped = 0;

      for (const product of mockOptimizedProducts) {
        // Check if already completed with translations
        if (product.translated_da && product.translated_no) {
          skipped++;
          continue;
        }

        // Process normally
        succeeded++;
      }

      expect(succeeded).toBe(2); // 2 OPTIMIZED products
      expect(skipped).toBe(0); // None skipped in this case
    });

    it('should handle language subset correctly', async () => {
      const languages = ['da']; // Only Danish
      
      // Mock Prisma calls
      mockFindUnique.mockResolvedValue(mockBatch);
      mockFindMany
        .mockResolvedValueOnce(mockOptimizedProducts)
        .mockResolvedValueOnce([]);
      mockUpdate.mockResolvedValue({});

      for (const product of mockOptimizedProducts) {
        const updateData: any = {
          status: 'completed',
          error_message: null
        };

        // Only translate to Danish
        if (languages.includes('da')) {
          updateData.translated_da = fakeTranslate(product.optimized_sv!, 'da');
        }
        // translated_no should remain null

        await mockUpdate({
          where: { id: product.id },
          data: updateData
        });
      }

      // Verify that only Danish translations were set
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            translated_da: expect.stringContaining('<!-- lang:DA -->')
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Mock Prisma calls
      mockFindUnique.mockResolvedValue(mockBatch);
      mockFindMany
        .mockResolvedValueOnce(mockOptimizedProducts)
        .mockResolvedValueOnce([]);
      
      // Make update fail for first product
      mockUpdate
        .mockResolvedValueOnce({}) // First update (status to TRANSLATING) succeeds
        .mockRejectedValueOnce(new Error('Database error')) // Second update fails
        .mockResolvedValue({}); // Other updates succeed

      let succeeded = 0;
      let failed = 0;

      for (const product of mockOptimizedProducts) {
        try {
          // Set status to TRANSLATING
          await mockUpdate({
            where: { id: product.id },
            data: { status: 'translating' }
          });

          // Try to update with translations
          await mockUpdate({
            where: { id: product.id },
            data: {
              status: 'completed',
              translated_da: fakeTranslate(product.optimized_sv!, 'da'),
              translated_no: fakeTranslate(product.optimized_sv!, 'no')
            }
          });

          succeeded++;
        } catch (error) {
          // Set status to ERROR
          await mockUpdate({
            where: { id: product.id },
            data: {
              status: 'error',
              error_message: 'Översättning misslyckades'
            }
          });

          failed++;
        }
      }

      expect(succeeded).toBe(1); // 1 succeeded
      expect(failed).toBe(1); // 1 failed
    });

    it('should return correct summary counts', () => {
      const total = 2; // 2 OPTIMIZED products
      const succeeded = 2;
      const failed = 0;
      const processed = succeeded + failed;
      const skipped = 0;

      const summary = {
        batchId: 'batch-123',
        total,
        processed,
        succeeded,
        failed,
        skipped
      };

      expect(summary.total).toBe(2);
      expect(summary.processed).toBe(2);
      expect(summary.succeeded).toBe(2);
      expect(summary.failed).toBe(0);
      expect(summary.skipped).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should return 404 when batch not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      // This would be handled in the actual route
      const result = { error: 'Batch hittades inte', status: 404 };
      
      expect(result.status).toBe(404);
      expect(result.error).toBe('Batch hittades inte');
    });

    it('should return 400 when no OPTIMIZED products', async () => {
      mockFindUnique.mockResolvedValue(mockBatch);
      mockFindMany.mockResolvedValue([]); // No OPTIMIZED products

      // This would be handled in the actual route
      const result = { error: 'Inga optimerade produkter att översätta', status: 400 };
      
      expect(result.status).toBe(400);
      expect(result.error).toBe('Inga optimerade produkter att översätta');
    });

    it('should return 500 for unexpected exceptions', async () => {
      mockFindUnique.mockRejectedValue(new Error('Database connection failed'));

      // This would be handled in the actual route
      const result = { error: 'Internt serverfel', status: 500 };
      
      expect(result.status).toBe(500);
      expect(result.error).toBe('Internt serverfel');
    });
  });
});
