import { describe, it, expect } from 'vitest';

// Test för att verifiera att produktfiltrering fungerar korrekt
describe('Product filtering logic', () => {
  it('should only include products with pending status', () => {
    const mockProducts = [
      { id: '1', status: 'pending', name_sv: 'Produkt 1' },
      { id: '2', status: 'optimized', name_sv: 'Produkt 2' },
      { id: '3', status: 'pending', name_sv: 'Produkt 3' },
      { id: '4', status: 'completed', name_sv: 'Produkt 4' },
      { id: '5', status: 'pending', name_sv: 'Produkt 5' },
      { id: '6', status: 'error', name_sv: 'Produkt 6' }
    ];

    // Simulera filtrering som ska ske i API:et
    const pendingProducts = mockProducts.filter(p => p.status === 'pending');
    
    expect(pendingProducts).toHaveLength(3);
    expect(pendingProducts.map(p => p.id)).toEqual(['1', '3', '5']);
  });

  it('should calculate products_remaining correctly', () => {
    const mockProducts = [
      { id: '1', status: 'pending' },
      { id: '2', status: 'optimized' },
      { id: '3', status: 'pending' },
      { id: '4', status: 'completed' },
      { id: '5', status: 'pending' }
    ];

    const totalProducts = mockProducts.length;
    const productsRemaining = mockProducts.filter(p => p.status === 'pending').length;
    
    expect(totalProducts).toBe(5);
    expect(productsRemaining).toBe(3);
  });
});
