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
        orderBy: { created_at: 'asc' } // Use creation order to match original file
      })
      
      // Sort by original row number if available in raw_data
      products.sort((a, b) => {
        try {
          const aRawData = a.raw_data ? JSON.parse(a.raw_data) : null
          const bRawData = b.raw_data ? JSON.parse(b.raw_data) : null
          
          if (aRawData && bRawData && aRawData.__original_row_number__ && bRawData.__original_row_number__) {
            return aRawData.__original_row_number__ - bRawData.__original_row_number__
          }
        } catch (error) {
          console.warn('Failed to parse raw_data for sorting:', error)
        }
        
        // Fallback to created_at order
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      // No deduplication needed - each product has a unique ID
      // If there are duplicates in the Excel file, they should be shown as separate rows

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Produkter')
      
      // Use raw_data from first product to determine original structure
      let originalHeaders: string[] = []
      let hasRawData = false
      
      if (products.length > 0 && products[0].raw_data) {
        try {
          const rawData = JSON.parse(products[0].raw_data)
          originalHeaders = Object.keys(rawData).filter(key => key !== '__original_row_number__')
          hasRawData = true
        } catch (error) {
          console.warn('Failed to parse raw_data for headers:', error)
        }
      }
      
      // Build headers based on original structure
      let headers: any[] = []
      if (hasRawData && originalHeaders.length > 0) {
        // Use original column structure
        originalHeaders.forEach(header => {
          headers.push({
            header: header,
            key: header,
            width: 40
          })
        })
        
        // Add optimized and translation columns after original columns
        headers.push({
          header: 'Optimerad text (SV)',
          key: 'optimized_sv',
          width: 50
        })
        
        // Add dynamic translation columns with proper locale mapping
        translationLanguages.forEach(langCode => {
          // Map internal language codes to proper locale format
          const localeMap: Record<string, string> = {
            'da': 'da-DK',
            'no': 'nb-NO',  // Use nb-NO to match import format
            'en': 'en-US',
            'de': 'de-DE',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'nl': 'nl-NL',
            'pl': 'pl-PL',
            'ru': 'ru-RU',
            'fi': 'fi-FI'
          }
          
          const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`
          headers.push({
            header: `Beskrivning (${locale})`,
            key: `description_${langCode}`,
            width: 50
          })
        })
      } else {
        // Fallback to default structure
        headers = [
          { header: 'Produktnamn', key: 'name', width: 30 },
          { header: 'Beskrivning (SV)', key: 'description', width: 50 },
          { header: 'Optimerad text (SV)', key: 'optimized', width: 50 }
        ]
        
        // Add dynamic translation columns with proper locale mapping
        translationLanguages.forEach(langCode => {
          // Map internal language codes to proper locale format
          const localeMap: Record<string, string> = {
            'da': 'da-DK',
            'no': 'nb-NO',  // Use nb-NO to match import format
            'en': 'en-US',
            'de': 'de-DE',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'nl': 'nl-NL',
            'pl': 'pl-PL',
            'ru': 'ru-RU',
            'fi': 'fi-FI'
          }
          
          const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`
          headers.push({
            header: `Beskrivning (${locale})`,
            key: `description_${langCode}`,
            width: 50
          })
        })
        
      }
      
      worksheet.columns = headers

      // Add data rows
      products.forEach(product => {
        let rowData: any = {}
        
        if (hasRawData && product.raw_data) {
          try {
            // Start with original raw data
            rowData = JSON.parse(product.raw_data)
            
            // Remove internal fields that shouldn't be exported
            delete rowData['__original_row_number__']
            
            // Add optimized text
            rowData['optimized_sv'] = product.optimized_sv || ''
            
            // Override with translations where available
            if (product.translations) {
              const translations = JSON.parse(product.translations)
              translationLanguages.forEach(langCode => {
                // Map internal language codes to proper locale format for column names
                const localeMap: Record<string, string> = {
                  'da': 'da-DK',
                  'no': 'nb-NO',  // Use nb-NO to match import format
                  'en': 'en-US',
                  'de': 'de-DE',
                  'fr': 'fr-FR',
                  'es': 'es-ES',
                  'it': 'it-IT',
                  'pt': 'pt-PT',
                  'nl': 'nl-NL',
                  'pl': 'pl-PL',
                  'ru': 'ru-RU',
                  'fi': 'fi-FI'
                }
                
                rowData[`description_${langCode}`] = translations[langCode] || ''
              })
            } else {
              // Fallback to legacy fields
              translationLanguages.forEach(langCode => {
                // Map internal language codes to proper locale format for column names
                const localeMap: Record<string, string> = {
                  'da': 'da-DK',
                  'no': 'nb-NO',  // Use nb-NO to match import format
                  'en': 'en-US',
                  'de': 'de-DE',
                  'fr': 'fr-FR',
                  'es': 'es-ES',
                  'it': 'it-IT',
                  'pt': 'pt-PT',
                  'nl': 'nl-NL',
                  'pl': 'pl-PL',
                  'ru': 'ru-RU',
                  'fi': 'fi-FI'
                }
                
                rowData[`description_${langCode}`] = ''
                if (langCode === 'da' && product.translated_da) {
                  rowData[`description_${langCode}`] = product.translated_da
                } else if (langCode === 'no' && product.translated_no) {
                  rowData[`description_${langCode}`] = product.translated_no
                } else if (langCode === 'en' && product.translated_en) {
                  rowData[`description_${langCode}`] = product.translated_en
                } else if (langCode === 'de' && product.translated_de) {
                  rowData[`description_${langCode}`] = product.translated_de
                }
              })
            }
          } catch (error) {
            console.warn('Failed to parse raw_data for product:', product.id)
            // Fallback to default structure
            rowData = {
              name: product.name_sv,
              description: product.description_sv,
              optimized: product.optimized_sv || '',
              status: product.status,
              error: product.error_message || ''
            }
          }
        } else {
          // Fallback to default structure
          rowData = {
            name: product.name_sv,
            description: product.description_sv,
            optimized: product.optimized_sv || ''
          }
          
          // Add translations from the new translations field
          if (product.translations) {
            try {
              const translations = JSON.parse(product.translations)
              translationLanguages.forEach(langCode => {
                // Map internal language codes to proper locale format for column names
                const localeMap: Record<string, string> = {
                  'da': 'da-DK',
                  'no': 'nb-NO',  // Use nb-NO to match import format
                  'en': 'en-US',
                  'de': 'de-DE',
                  'fr': 'fr-FR',
                  'es': 'es-ES',
                  'it': 'it-IT',
                  'pt': 'pt-PT',
                  'nl': 'nl-NL',
                  'pl': 'pl-PL',
                  'ru': 'ru-RU',
                  'fi': 'fi-FI'
                }
                
                const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`
                rowData[locale] = translations[langCode] || ''
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
              // Map internal language codes to proper locale format for column names
              const localeMap: Record<string, string> = {
                'da': 'da-DK',
                'no': 'nb-NO',  // Use nb-NO to match import format
                'en': 'en-US',
                'de': 'de-DE',
                'fr': 'fr-FR',
                'es': 'es-ES',
                'it': 'it-IT',
                'pt': 'pt-PT',
                'nl': 'nl-NL',
                'pl': 'pl-PL',
                'ru': 'ru-RU',
                'fi': 'fi-FI'
              }
              
              const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`
              if (langCode === 'da' && product.translated_da) {
                rowData[locale] = product.translated_da
              } else if (langCode === 'no' && product.translated_no) {
                rowData[locale] = product.translated_no
              } else {
                rowData[locale] = ''
              }
            })
          }
        }
        
        worksheet.addRow(rowData)
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${upload.filename.replace('.xlsx', '')}_with_translations.xlsx"`
        }
      })
    } else {
      // Export UI items - recreate original Excel structure with translations
      const uiItems = await prisma.uIItem.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { created_at: 'asc' } // Use creation order to match original file
      })

      // Get original locale structure from upload metadata
      let originalLocales: string[] = []
      try {
        if (upload.meta) {
          const metaData = JSON.parse(upload.meta)
          if (metaData.locales) {
            originalLocales = metaData.locales
          }
        }
      } catch (error) {
        console.warn('Failed to parse upload metadata for locales:', error)
      }

      // Fallback: get locales from UI items if metadata not available
      if (originalLocales.length === 0) {
        const allLocales = new Set<string>()
        uiItems.forEach(item => {
          try {
            const values = JSON.parse(item.values)
            Object.keys(values).forEach(locale => {
              if (locale !== '__original_row_number__') {
                allLocales.add(locale)
              }
            })
          } catch (error) {
            console.warn('Failed to parse UI item values:', error)
          }
        })
        originalLocales = Array.from(allLocales).sort()
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('UI-element')
      
      // Create headers matching original Excel structure
      const columns = [
        { header: 'Name', key: 'name', width: 30 }
      ]
      
      // Add locale columns in original order
      originalLocales.forEach(locale => {
        columns.push({ header: locale, key: locale, width: 40 })
      })
      
      worksheet.columns = columns

      // Add data rows
      uiItems.forEach(item => {
        try {
          const values = JSON.parse(item.values)
          const row: any = {
            name: item.name
          }
          
          // Add each locale value in original column order
          originalLocales.forEach(locale => {
            row[locale] = values[locale] || ''
          })
          
          worksheet.addRow(row)
        } catch (error) {
          console.warn('Failed to parse UI item values for export:', error)
          const row: any = { name: item.name }
          originalLocales.forEach(locale => {
            row[locale] = ''
          })
          worksheet.addRow(row)
        }
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${upload.filename.replace('.xlsx', '')}_with_translations.xlsx"`
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
