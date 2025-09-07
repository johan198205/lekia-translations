import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params

    // Get batch with products or UI items
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: { 
        products: true,
        ui_items: true
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    if (batch.job_type === 'product_texts') {
      // Export products
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Produkter')
      
      // Get translation languages from settings
      let translationLanguages: string[] = []
      try {
        const settingsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/settings/openai`)
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json()
          if (settingsData.translationLanguages) {
            translationLanguages = JSON.parse(settingsData.translationLanguages)
          }
        }
      } catch (error) {
        console.warn('Failed to load translation languages for export:', error)
      }
      
      // Build dynamic headers
      const headers = [
        { header: 'Produktnamn', key: 'name', width: 30 },
        { header: 'Beskrivning (SV)', key: 'description', width: 50 },
        { header: 'Optimerad text (SV)', key: 'optimized', width: 50 }
      ]
      
      // Add dynamic translation columns
      translationLanguages.forEach(langCode => {
        headers.push({
          header: `Beskrivning (${langCode.toUpperCase()})`,
          key: `description_${langCode}`,
          width: 50
        })
      })
      
      headers.push(
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Felmeddelande', key: 'error', width: 30 }
      )
      
      worksheet.columns = headers

      // Add data rows
      batch.products.forEach(product => {
        const rowData: any = {
          name: product.name_sv,
          description: product.description_sv,
          optimized: product.optimized_sv || '',
          status: product.status,
          error: product.error_message || ''
        }
        
        // Add translations from the new translations field
        if (product.translations) {
          try {
            const translations = JSON.parse(product.translations)
            translationLanguages.forEach(langCode => {
              rowData[`description_${langCode}`] = translations[langCode] || ''
            })
          } catch (error) {
            console.warn('Failed to parse translations for product:', product.id)
            translationLanguages.forEach(langCode => {
              rowData[`description_${langCode}`] = ''
            })
          }
        } else {
          // Fallback to legacy fields for backward compatibility
          translationLanguages.forEach(langCode => {
            if (langCode === 'da' && product.translated_da) {
              rowData[`description_${langCode}`] = product.translated_da
            } else if (langCode === 'no' && product.translated_no) {
              rowData[`description_${langCode}`] = product.translated_no
            } else {
              rowData[`description_${langCode}`] = ''
            }
          })
        }
        
        worksheet.addRow(rowData)
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${batch.filename}_export.xlsx"`
        }
      })
    } else {
      // Export UI items
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('UI-element')
      
      // Get all unique locales from all UI items
      const allLocales = new Set<string>()
      batch.ui_items.forEach(item => {
        const values = JSON.parse(item.values)
        Object.keys(values).forEach(locale => allLocales.add(locale))
      })
      
      // Add headers
      const columns = [
        { header: 'Namn', key: 'name', width: 30 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Felmeddelande', key: 'error', width: 30 }
      ]
      
      // Add locale columns
      Array.from(allLocales).sort().forEach(locale => {
        columns.push({ header: locale, key: locale, width: 40 })
      })
      
      worksheet.columns = columns

      // Add data rows
      batch.ui_items.forEach(item => {
        const values = JSON.parse(item.values)
        const row: any = {
          name: item.name,
          status: item.status,
          error: item.error_message || ''
        }
        
        // Add each locale value
        Object.entries(values).forEach(([locale, value]) => {
          row[locale] = value || ''
        })
        
        worksheet.addRow(row)
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${batch.filename}_ui_export.xlsx"`
        }
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}