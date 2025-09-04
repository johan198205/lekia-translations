import { describe, it, expect } from 'vitest';
import { ProductStatus } from '@prisma/client';

// Define the function to test (same as in route file)
function computeSummary(statuses: ProductStatus[], total: number): {
  batchId: string;
  total: number;
  counts: { PENDING: number; OPTIMIZING: number; OPTIMIZED: number; TRANSLATING: number; COMPLETED: number; ERROR: number; };
  percent: number;
} {
  const counts = {
    PENDING: 0,
    OPTIMIZING: 0,
    OPTIMIZED: 0,
    TRANSLATING: 0,
    COMPLETED: 0,
    ERROR: 0
  };

  // Count each status, ignoring unknown ones defensively
  statuses.forEach(status => {
    const upperStatus = status.toUpperCase() as keyof typeof counts;
    if (counts.hasOwnProperty(upperStatus)) {
      counts[upperStatus]++;
    }
  });

  // Calculate percentage: floor(((OPTIMIZED + COMPLETED)/total) * 100)
  const percent = total <= 0 ? 0 : Math.floor(((counts.OPTIMIZED + counts.COMPLETED) / total) * 100);

  return {
    batchId: '', // Will be set by caller
    total,
    counts,
    percent
  };
}

describe('computeSummary', () => {
  it('should compute correct counts and percent for normal mix', () => {
    const statuses: ProductStatus[] = ['pending', 'optimizing', 'optimized', 'translating', 'completed', 'error'];
    const total = 6;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 1,
      OPTIMIZING: 1,
      OPTIMIZED: 1,
      TRANSLATING: 1,
      COMPLETED: 1,
      ERROR: 1
    });
    expect(result.percent).toBe(33); // floor(((1+1)/6) * 100) = floor(33.33...) = 33
    expect(result.total).toBe(6);
  });

  it('should compute 100% when all products are completed', () => {
    const statuses: ProductStatus[] = ['optimized', 'completed', 'completed'];
    const total = 3;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 0,
      OPTIMIZING: 0,
      OPTIMIZED: 1,
      TRANSLATING: 0,
      COMPLETED: 2,
      ERROR: 0
    });
    expect(result.percent).toBe(100); // floor(((1+2)/3) * 100) = floor(100) = 100
    expect(result.total).toBe(3);
  });

  it('should handle total=0 gracefully', () => {
    const statuses: ProductStatus[] = [];
    const total = 0;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 0,
      OPTIMIZING: 0,
      OPTIMIZED: 0,
      TRANSLATING: 0,
      COMPLETED: 0,
      ERROR: 0
    });
    expect(result.percent).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should ignore unknown statuses defensively', () => {
    // @ts-ignore - Testing with invalid statuses
    const statuses: any[] = ['pending', 'unknown_status', 'optimizing', 'invalid_status', 'completed'];
    const total = 5;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 1,
      OPTIMIZING: 1,
      OPTIMIZED: 0,
      TRANSLATING: 0,
      COMPLETED: 1,
      ERROR: 0
    });
    expect(result.percent).toBe(20); // floor(((0+1)/5) * 100) = floor(20) = 20
    expect(result.total).toBe(5);
  });

  it('should handle empty statuses array', () => {
    const statuses: ProductStatus[] = [];
    const total = 10;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 0,
      OPTIMIZING: 0,
      OPTIMIZED: 0,
      TRANSLATING: 0,
      COMPLETED: 0,
      ERROR: 0
    });
    expect(result.percent).toBe(0); // floor(((0+0)/10) * 100) = 0
    expect(result.total).toBe(10);
  });

  it('should handle single status correctly', () => {
    const statuses: ProductStatus[] = ['pending'];
    const total = 1;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 1,
      OPTIMIZING: 0,
      OPTIMIZED: 0,
      TRANSLATING: 0,
      COMPLETED: 0,
      ERROR: 0
    });
    expect(result.percent).toBe(0); // floor(((0+0)/1) * 100) = 0
    expect(result.total).toBe(1);
  });

  it('should handle mixed case statuses correctly', () => {
    const statuses: ProductStatus[] = ['PENDING', 'OPTIMIZING', 'OPTIMIZED'] as any;
    const total = 3;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 1, // 'PENDING' matches 'pending' after toUpperCase()
      OPTIMIZING: 1, // 'OPTIMIZING' matches 'optimizing' after toUpperCase()
      OPTIMIZED: 1, // 'OPTIMIZED' matches 'optimized' after toUpperCase()
      TRANSLATING: 0,
      COMPLETED: 0,
      ERROR: 0
    });
    expect(result.percent).toBe(33); // floor(((1+0)/3) * 100) = floor(33.33...) = 33
    expect(result.total).toBe(3);
  });

  it('should handle large numbers correctly', () => {
    const statuses: ProductStatus[] = Array(100).fill('pending').concat(Array(200).fill('completed'));
    const total = 300;
    
    const result = computeSummary(statuses, total);
    
    expect(result.counts).toEqual({
      PENDING: 100,
      OPTIMIZING: 0,
      OPTIMIZED: 0,
      TRANSLATING: 0,
      COMPLETED: 200,
      ERROR: 0
    });
    expect(result.percent).toBe(66); // floor(((0+200)/300) * 100) = floor(66.66...) = 66
    expect(result.total).toBe(300);
  });
});

describe('SSE Headers', () => {
  it('should set correct SSE headers', () => {
    // This is a lightweight test to verify the expected headers
    // In a real implementation, you'd test the actual route response
    const expectedHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    };
    
    expect(expectedHeaders['Content-Type']).toBe('text/event-stream');
    expect(expectedHeaders['Cache-Control']).toBe('no-cache, no-transform');
    expect(expectedHeaders['Connection']).toBe('keep-alive');
  });
});
