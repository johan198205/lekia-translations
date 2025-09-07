import { describe, it, expect } from 'vitest';
import { normalizeToken, extractTokens, getAvailableTokens, replaceTokens } from '@/lib/token-extractor';

describe('Token Extractor', () => {
  describe('normalizeToken', () => {
    it('should normalize basic headers', () => {
      expect(normalizeToken('Product Name')).toBe('product_name');
      expect(normalizeToken('Description_SV')).toBe('description_sv');
      expect(normalizeToken('Brand/Märke')).toBe('brand_m_rke');
    });

    it('should preserve ISO locale codes', () => {
      expect(normalizeToken('sv-SE')).toBe('sv-se');
      expect(normalizeToken('en-US')).toBe('en-us');
    });

    it('should handle special characters', () => {
      expect(normalizeToken('Bullet Point 1')).toBe('bullet_point_1');
      expect(normalizeToken('Feature-List')).toBe('feature_list');
    });
  });

  describe('extractTokens', () => {
    it('should extract tokens from headers', () => {
      const headers = ['ArticleId', 'Title', 'Description_sv', 'Brand', 'Bullet_1'];
      const result = extractTokens(headers);
      
      expect(result.tokens).toHaveLength(4); // Bullet_1 is handled separately
      expect(result.tokens[0].token).toBe('articleid');
      expect(result.tokens[1].token).toBe('title');
      expect(result.tokens[2].token).toBe('description_sv');
      expect(result.tokens[3].token).toBe('brand');
      expect(result.tokens.find(t => t.token === 'bullets[]')).toBeDefined();
    });

    it('should handle bullet columns', () => {
      const headers = ['Title', 'Bullet_1', 'Bullet_2', 'Feature_1'];
      const result = extractTokens(headers);
      
      expect(result.tokens).toHaveLength(3); // Title + bullets[] + Feature_1
      expect(result.tokens.find(t => t.token === 'bullets[]')).toBeDefined();
      expect(result.tokens.find(t => t.token === 'title')).toBeDefined();
      expect(result.tokens.find(t => t.token === 'feature_1')).toBeDefined();
    });

    it('should include system tokens', () => {
      const headers = ['Title', 'Description'];
      const result = extractTokens(headers);
      
      expect(result.systemTokens).toContain('targetLang');
      expect(result.systemTokens).toContain('jobType');
      expect(result.systemTokens).toContain('uploadName');
      expect(result.systemTokens).toContain('batchName');
    });
  });

  describe('getAvailableTokens', () => {
    it('should prefer upload tokens over settings tokens', () => {
      const uploadTokens = [{ token: 'title', original: 'Title' }];
      const settingsTokens = [{ token: 'name', original: 'Name' }];
      
      const result = getAvailableTokens(uploadTokens, settingsTokens);
      expect(result).toEqual(uploadTokens);
    });

    it('should fall back to settings tokens when upload tokens are empty', () => {
      const uploadTokens: any[] = [];
      const settingsTokens = [{ token: 'name', original: 'Name' }];
      
      const result = getAvailableTokens(uploadTokens, settingsTokens);
      expect(result).toEqual(settingsTokens);
    });

    it('should return empty array when both are empty', () => {
      const result = getAvailableTokens([], []);
      expect(result).toEqual([]);
    });
  });

  describe('replaceTokens', () => {
    it('should replace available tokens', () => {
      const template = 'Product: {{title}}, Description: {{description}}';
      const availableTokens = [
        { token: 'title', original: 'Title' },
        { token: 'description', original: 'Description' }
      ];
      const values = {
        title: 'Test Product',
        description: 'Test Description'
      };
      
      const result = replaceTokens(template, availableTokens, values);
      expect(result).toBe('Product: Test Product, Description: Test Description');
    });

    it('should leave unavailable tokens unchanged', () => {
      const template = 'Product: {{title}}, Price: {{price}}';
      const availableTokens = [{ token: 'title', original: 'Title' }];
      const values = { title: 'Test Product' };
      
      const result = replaceTokens(template, availableTokens, values);
      expect(result).toBe('Product: Test Product, Price: ');
    });
  });
});
