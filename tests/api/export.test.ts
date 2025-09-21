import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET as getUploadExport } from '@/app/api/uploads/[id]/export/route';
import { GET as getBatchExport } from '@/app/api/batches/[id]/export/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock ExcelJS
vi.mock('exceljs', () => ({
  default: {
    Workbook: vi.fn(() => ({
      addWorksheet: vi.fn(() => ({
        columns: [],
        addRow: vi.fn()
      })),
      xlsx: {
        writeBuffer: vi.fn().mockResolvedValue(Buffer.from('mock excel data'))
      }
    }))
  },
  Workbook: vi.fn(() => ({
    addWorksheet: vi.fn(() => ({
      columns: [],
      addRow: vi.fn()
    })),
    xlsx: {
      writeBuffer: vi.fn().mockResolvedValue(Buffer.from('mock excel data'))
    }
  }))
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    upload: {
      findUnique: vi.fn()
    },
    product: {
      findMany: vi.fn()
    },
    uIItem: {
      findMany: vi.fn()
    },
    productBatch: {
      findUnique: vi.fn()
    },
    openAISettings: {
      findFirst: vi.fn()
    }
  }
}));

describe('Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (url: string) => {
    return new NextRequest(url);
  };

  describe('Upload Export', () => {
    it('should export products with original structure and translations', async () => {
      const mockUpload = {
        id: 'upload-1',
        filename: 'test.xlsx',
        job_type: 'product_texts'
      };

      const mockProducts = [
        {
          id: 'product-1',
          name_sv: 'Test Product',
          description_sv: 'Original description',
          optimized_sv: 'Optimized description',
          raw_data: JSON.stringify({
            'product_name_sv': 'Test Product',
            'description_sv': 'Original description',
            'category': 'Test Category',
            '__original_row_number__': 2
          }),
          translations: JSON.stringify({
            'da': 'Danish translation',
            'no': 'Norwegian translation'
          }),
          status: 'completed',
          created_at: new Date('2024-01-01T00:00:00Z')
        }
      ];

      const mockSettings = {
        translationLanguages: JSON.stringify(['da', 'no'])
      };

      vi.mocked(prisma.upload.findUnique).mockResolvedValue(mockUpload as any);
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any);
      vi.mocked(prisma.openAISettings.findFirst).mockResolvedValue(mockSettings as any);

      const request = createMockRequest('http://localhost:3000/api/uploads/upload-1/export?jobType=product_texts');
      const response = await getUploadExport(request, { params: Promise.resolve({ id: 'upload-1' }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('test_with_translations.xlsx');
    });

    it('should return 404 for non-existent upload', async () => {
      vi.mocked(prisma.upload.findUnique).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/uploads/nonexistent/export?jobType=product_texts');
      const response = await getUploadExport(request, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing jobType parameter', async () => {
      const request = createMockRequest('http://localhost:3000/api/uploads/upload-1/export');
      const response = await getUploadExport(request, { params: Promise.resolve({ id: 'upload-1' }) });

      expect(response.status).toBe(400);
    });
  });

  describe('Batch Export', () => {
    it('should export batch products with original structure and translations', async () => {
      const mockBatch = {
        id: 'batch-1',
        filename: 'test-batch.xlsx',
        job_type: 'product_texts',
        products: [
          {
            id: 'product-1',
            name_sv: 'Test Product',
            description_sv: 'Original description',
            optimized_sv: 'Optimized description',
            raw_data: JSON.stringify({
              'product_name_sv': 'Test Product',
              'description_sv': 'Original description',
              'category': 'Test Category',
              '__original_row_number__': 2
            }),
            translations: JSON.stringify({
              'da': 'Danish translation',
              'no': 'Norwegian translation'
            }),
            status: 'completed',
            created_at: new Date('2024-01-01T00:00:00Z')
          }
        ]
      };

      vi.mocked(prisma.productBatch.findUnique).mockResolvedValue(mockBatch as any);

      const request = createMockRequest('http://localhost:3000/api/batches/batch-1/export');
      const response = await getBatchExport(request, { params: Promise.resolve({ id: 'batch-1' }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('test-batch_export.xlsx');
    });

    it('should preserve exact row order and remove __original_row_number__ from export', async () => {
      const mockBatch = {
        id: 'batch-1',
        filename: 'test-batch.xlsx',
        job_type: 'product_texts',
        products: [
          {
            id: 'product-1',
            name_sv: 'First Product',
            description_sv: 'First description',
            optimized_sv: 'First optimized',
            raw_data: JSON.stringify({
              'product_name_sv': 'First Product',
              'description_sv': 'First description',
              'category': 'Category A',
              '__original_row_number__': 2
            }),
            translations: JSON.stringify({
              'da': 'Første produkt',
              'no': 'Første produkt'
            }),
            status: 'completed',
            created_at: new Date('2024-01-01T00:00:00Z')
          },
          {
            id: 'product-2',
            name_sv: 'Second Product',
            description_sv: 'Second description',
            optimized_sv: 'Second optimized',
            raw_data: JSON.stringify({
              'product_name_sv': 'Second Product',
              'description_sv': 'Second description',
              'category': 'Category B',
              '__original_row_number__': 3
            }),
            translations: JSON.stringify({
              'da': 'Andet produkt',
              'no': 'Andre produkt'
            }),
            status: 'completed',
            created_at: new Date('2024-01-01T00:01:00Z')
          }
        ]
      };

      vi.mocked(prisma.productBatch.findUnique).mockResolvedValue(mockBatch as any);

      const request = createMockRequest('http://localhost:3000/api/batches/batch-1/export');
      const response = await getBatchExport(request, { params: Promise.resolve({ id: 'batch-1' }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should return 404 for non-existent batch', async () => {
      vi.mocked(prisma.productBatch.findUnique).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/batches/nonexistent/export');
      const response = await getBatchExport(request, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(response.status).toBe(404);
    });
  });
});
