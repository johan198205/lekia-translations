import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params
    const { searchParams } = new URL(request.url)
    const jobType = searchParams.get('jobType') as 'product_texts' | 'ui_strings'

    if (!jobType) {
      return NextResponse.json(
        { error: 'jobType parameter is required' },
        { status: 400 }
      )
    }

    // Get upload info
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    if (upload.job_type !== jobType) {
      return NextResponse.json(
        { error: 'Upload job type mismatch' },
        { status: 400 }
      )
    }

    // Get translation languages from settings
    let translationLanguages: string[] = []
    try {
      const settings = await prisma.openAISettings.findFirst({
        orderBy: { updated_at: 'desc' }
      })
      if (settings?.translationLanguages) {
        translationLanguages = JSON.parse(settings.translationLanguages)
      }
    } catch (error) {
      console.warn('Failed to load translation languages for export:', error)
    }

    if (jobType === 'product_texts') {
      // Get all products from this upload
      const products = await prisma.product.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { updated_at: 'desc' }
      })

      // No deduplication needed - each product has a unique ID
      // If there are duplicates in the Excel file, they should be shown as separate rows

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Produkter')
      
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
      products.forEach(product => {
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
          'Content-Disposition': `attachment; filename="${upload.filename}_upload_export.xlsx"`
        }
      })
    } else {
      // Export UI items
      const uiItems = await prisma.uIItem.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { updated_at: 'desc' }
      })

      // No deduplication needed - each UI item has a unique ID

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('UI-element')
      
      // Get all unique locales from all UI items
      const allLocales = new Set<string>()
      uiItems.forEach(item => {
        try {
          const values = JSON.parse(item.values)
          Object.keys(values).forEach(locale => allLocales.add(locale))
        } catch (error) {
          console.warn('Failed to parse UI item values:', error)
        }
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
      uiItems.forEach(item => {
        try {
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
        } catch (error) {
          console.warn('Failed to parse UI item values for export:', error)
          worksheet.addRow({
            name: item.name,
            status: item.status,
            error: item.error_message || ''
          })
        }
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${upload.filename}_ui_upload_export.xlsx"`
        }
      })
    }
  } catch (error) {
    console.error('Upload export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
