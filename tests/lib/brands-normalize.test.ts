import { describe, it, expect } from 'vitest'
import { normalize } from '@/lib/excel/normalize'
import * as ExcelJS from 'exceljs'

describe('Brands Normalization', () => {
  it('should preserve exact headers and row order from Excel', async () => {
    // Create a test workbook with exact headers like the user's example
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Brands')
    
    // Add headers exactly as they appear in the user's Excel file
    const headers = [
      'Namn på sidan (no)',
      'Titel på sidan (sv)', 
      'Titel på sidan (no)',
      'Kort beskrivning (sv)',
      'Kort beskrivning (no)',
      'Lång beskrivning HTML (sv)',
      'Lång beskrivning HTML (no)'
    ]
    
    // Add header row
    worksheet.addRow(headers)
    
    // Add test data rows
    const testData = [
      ['5 Surprises', '5 Surprises', '5 Surprises', 'Short desc SV', 'Short desc NO', 'Long HTML SV', 'Long HTML NO'],
      ['Accutime', 'Accutime', 'Accutime', 'Short desc SV', 'Short desc NO', 'Long HTML SV', 'Long HTML NO'],
      ['Action & Reaction', 'Action & Reaction', 'Action & Reaction', 'Short desc SV', 'Short desc NO', 'Long HTML SV', 'Long HTML NO']
    ]
    
    testData.forEach(row => worksheet.addRow(row))
    
    // Convert to buffer
    const buffer = await workbook.xlsx.writeBuffer()
    
    // Test normalization
    const result = await normalize(buffer, 'brands')
    
    // Verify headers are preserved exactly
    expect(result.meta.headers).toEqual(headers)
    
    // Verify brands were created
    expect(result.brands).toHaveLength(3)
    
    // Verify first brand has correct raw_data structure
    const firstBrand = result.brands![0]
    expect(firstBrand.raw_data).toBeDefined()
    
    // raw_data is already an object in the normalize result
    const rawData = firstBrand.raw_data!
    expect(rawData['Namn på sidan (no)']).toBe('5 Surprises')
    expect(rawData['Titel på sidan (sv)']).toBe('5 Surprises')
    expect(rawData['Titel på sidan (no)']).toBe('5 Surprises')
    expect(rawData['Kort beskrivning (sv)']).toBe('Short desc SV')
    expect(rawData['Kort beskrivning (no)']).toBe('Short desc NO')
    expect(rawData['Lång beskrivning HTML (sv)']).toBe('Long HTML SV')
    expect(rawData['Lång beskrivning HTML (no)']).toBe('Long HTML NO')
    
    // Verify row order is preserved (first row should be "5 Surprises")
    expect(firstBrand.name_sv).toBe('5 Surprises')
    
    // Verify second brand (should be "Accutime")
    const secondBrand = result.brands![1]
    expect(secondBrand.name_sv).toBe('Accutime')
    
    // Verify third brand (should be "Action & Reaction")
    const thirdBrand = result.brands![2]
    expect(thirdBrand.name_sv).toBe('Action & Reaction')
  })
  
  it('should handle empty cells correctly', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Brands')
    
    const headers = ['Namn på sidan (no)', 'Titel på sidan (sv)', 'Kort beskrivning (sv)']
    worksheet.addRow(headers)
    
    // Add row with some empty cells
    worksheet.addRow(['Brand Name', '', 'Description'])
    
    const buffer = await workbook.xlsx.writeBuffer()
    const result = await normalize(buffer, 'brands')
    
    expect(result.brands).toHaveLength(1)
    const brand = result.brands![0]
    const rawData = brand.raw_data!
    
    expect(rawData['Namn på sidan (no)']).toBe('Brand Name')
    expect(rawData['Titel på sidan (sv)']).toBe('')
    expect(rawData['Kort beskrivning (sv)']).toBe('Description')
  })
})
