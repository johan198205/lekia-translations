import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/upload/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock the normalize function
vi.mock('@/lib/excel/normalize', () => ({
  normalize: vi.fn(),
  NormalizationError: class NormalizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NormalizationError';
    }
  }
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    upload: {
      create: vi.fn()
    },
    product: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    uIItem: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe('Upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (file: File, jobType?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (jobType) {
      formData.append('jobType', jobType);
    }
    
    return {
      formData: () => Promise.resolve(formData),
    } as NextRequest;
  };

  const createMockFile = (name: string, size: number, type: string): File => {
    const file = new File([''], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  describe('File validation', () => {
    it('should reject non-xlsx files by extension', async () => {
      const file = createMockFile('test.txt', 100, 'text/plain');
      const request = createMockRequest(file);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid file type');
    });

    it('should reject files larger than 16MB', async () => {
      const file = createMockFile('test.xlsx', 17 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const request = createMockRequest(file);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toBe('File too large');
    });

    it('should reject invalid job types', async () => {
      const file = createMockFile('test.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const request = createMockRequest(file, 'invalid_job_type');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid job type');
    });
  });

  describe('Product texts upload', () => {
    it('should handle product texts upload successfully', async () => {
      const { normalize } = await import('@/lib/excel/normalize');
      const mockNormalize = vi.mocked(normalize);
      
      const mockProducts = [
        { name_sv: 'Produkt A', description_sv: 'Beskrivning A' },
        { name_sv: 'Produkt B', description_sv: 'Beskrivning B' }
      ];

      mockNormalize.mockResolvedValue({
        products: mockProducts,
        meta: { rows: 2, skipped: 0 }
      });

      const mockUpload = { id: 'upload-123', filename: 'test.xlsx' };
      const mockProductsCreated = [
        { id: 'product-1', name_sv: 'Produkt A' },
        { id: 'product-2', name_sv: 'Produkt B' }
      ];

      vi.mocked(prisma.upload.create).mockResolvedValue(mockUpload as any);
      vi.mocked(prisma.product.create).mockResolvedValueOnce(mockProductsCreated[0] as any);
      vi.mocked(prisma.product.create).mockResolvedValueOnce(mockProductsCreated[1] as any);
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProductsCreated as any);

      const file = createMockFile('test.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const request = createMockRequest(file, 'product_texts');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.uploadId).toBe('upload-123');
      expect(data.products).toEqual(mockProducts);
      expect(mockNormalize).toHaveBeenCalledWith(expect.any(Buffer), 'product_texts');
      expect(prisma.upload.create).toHaveBeenCalledWith({
        data: {
          filename: 'test.xlsx',
          upload_date: expect.any(Date),
          total_products: 2,
          job_type: 'product_texts'
        }
      });
    });
  });

  describe('UI strings upload', () => {
    it('should handle UI strings upload successfully', async () => {
      const { normalize } = await import('@/lib/excel/normalize');
      const mockNormalize = vi.mocked(normalize);
      
      const mockUIStrings = [
        { name: 'button.save', values: { 'en-US': 'Save', 'sv-SE': 'Spara' } },
        { name: 'button.cancel', values: { 'en-US': 'Cancel', 'sv-SE': 'Avbryt' } }
      ];

      mockNormalize.mockResolvedValue({
        uiStrings: mockUIStrings,
        meta: { rows: 2, skipped: 0, locales: ['en-US', 'sv-SE'] }
      });

      const mockUpload = { id: 'upload-456', filename: 'ui-strings.xlsx' };
      const mockUIItemsCreated = [
        { id: 'ui-item-1', name: 'button.save' },
        { id: 'ui-item-2', name: 'button.cancel' }
      ];

      vi.mocked(prisma.upload.create).mockResolvedValue(mockUpload as any);
      vi.mocked(prisma.uIItem.create).mockResolvedValueOnce(mockUIItemsCreated[0] as any);
      vi.mocked(prisma.uIItem.create).mockResolvedValueOnce(mockUIItemsCreated[1] as any);
      vi.mocked(prisma.uIItem.findMany).mockResolvedValue(mockUIItemsCreated as any);

      const file = createMockFile('ui-strings.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const request = createMockRequest(file, 'ui_strings');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.uploadId).toBe('upload-456');
      expect(data.uiStrings).toEqual(mockUIStrings);
      expect(data.meta.locales).toEqual(['en-US', 'sv-SE']);
      expect(mockNormalize).toHaveBeenCalledWith(expect.any(Buffer), 'ui_strings');
      expect(prisma.upload.create).toHaveBeenCalledWith({
        data: {
          filename: 'ui-strings.xlsx',
          upload_date: expect.any(Date),
          total_products: 2,
          job_type: 'ui_strings'
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle missing file', async () => {
      const formData = new FormData();
      const request = {
        formData: () => Promise.resolve(formData),
      } as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No file provided');
    });

    it('should handle normalization errors', async () => {
      const { normalize, NormalizationError } = await import('@/lib/excel/normalize');
      const mockNormalize = vi.mocked(normalize);
      
      const error = new NormalizationError('Missing required columns: name_sv');
      mockNormalize.mockRejectedValue(error);

      const file = createMockFile('test.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const request = createMockRequest(file);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required columns: name_sv');
    });

    it('should handle database errors', async () => {
      const { normalize } = await import('@/lib/excel/normalize');
      const mockNormalize = vi.mocked(normalize);
      
      mockNormalize.mockResolvedValue({
        products: [{ name_sv: 'Test', description_sv: 'Test' }],
        meta: { rows: 1, skipped: 0 }
      });

      vi.mocked(prisma.upload.create).mockRejectedValue(new Error('Database error'));

      const file = createMockFile('test.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const request = createMockRequest(file);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
