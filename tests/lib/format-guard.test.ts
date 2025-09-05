import { describe, it, expect } from 'vitest'
import { cleanTranslationFormat } from '../../lib/format-guard'

describe('format-guard', () => {
  describe('cleanTranslationFormat', () => {
    it('should remove leading # from translation if original does not start with #', () => {
      const original = 'Detta är en testprodukt\n\n## Fördelar\n- Punkt 1'
      const translated = '# Dette er en testprodukt\n\n## Fordeler\n- Punkt 1'
      
      const result = cleanTranslationFormat(original, translated)
      
      expect(result).toBe('Dette er en testprodukt\n\n## Fordeler\n- Punkt 1')
    })

    it('should preserve leading # if original starts with #', () => {
      const original = '# Kort beskrivning\nDetta är en testprodukt'
      const translated = '# Kort beskrivning\nDette er en testprodukt'
      
      const result = cleanTranslationFormat(original, translated)
      
      expect(result).toBe('# Kort beskrivning\nDette er en testprodukt')
    })

    it('should preserve ## and ### headings', () => {
      const original = 'Detta är en testprodukt\n\n## Fördelar'
      const translated = '# Dette er en testprodukt\n\n## Fordeler'
      
      const result = cleanTranslationFormat(original, translated)
      
      expect(result).toBe('Dette er en testprodukt\n\n## Fordeler')
    })

    it('should handle multiple lines with #', () => {
      const original = 'Detta är en testprodukt\n\n## Fördelar\n- Punkt 1'
      const translated = '# Dette er en testprodukt\n\n## Fordeler\n# - Punkt 1'
      
      const result = cleanTranslationFormat(original, translated)
      
      expect(result).toBe('Dette er en testprodukt\n\n## Fordeler\n- Punkt 1')
    })

    it('should handle empty strings', () => {
      const original = ''
      const translated = '# Test'
      
      const result = cleanTranslationFormat(original, translated)
      
      expect(result).toBe('Test')
    })
  })
})
