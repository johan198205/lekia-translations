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
        upload: true, // Include upload for metadata access
        products: {
          orderBy: { created_at: 'asc' } // Preserve original import order
        },
        ui_items: {
          orderBy: { created_at: 'asc' } // Preserve original import order
        },
        brands: {
          orderBy: { created_at: 'asc' } // Preserve original import order
        }
      }
    })
    
    // Sort products by original row number if available in raw_data
    if (batch?.products) {
      batch.products.sort((a, b) => {
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
    }
    
    // Sort UI items by original row number if available in values
    if (batch?.ui_items) {
      let hasRowNumbers = false
      
      // Check if any UI item has __original_row_number__
      for (const item of batch.ui_items) {
        try {
          const values = item.values ? JSON.parse(item.values) : null
          if (values && values.__original_row_number__) {
            hasRowNumbers = true
            break
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
      
      // Only sort if we have row numbers, otherwise use name-based sorting
      if (hasRowNumbers) {
        batch.ui_items.sort((a, b) => {
          try {
            const aValues = a.values ? JSON.parse(a.values) : null
            const bValues = b.values ? JSON.parse(b.values) : null
            
            if (aValues && bValues && aValues.__original_row_number__ && bValues.__original_row_number__) {
              return parseInt(aValues.__original_row_number__) - parseInt(bValues.__original_row_number__)
            }
          } catch (error) {
            console.warn('Failed to parse values for sorting:', error)
          }
          
          // Fallback to created_at order if row numbers missing
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
      } else {
        // For existing data without row numbers, try to sort by name to get logical order
        // This should group related items together (e.g., all addressform.* items)
        batch.ui_items.sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
      }
    }
    
    // Sort brands by original row number if available in raw_data
    if (batch?.brands) {
      batch.brands.sort((a, b) => {
        try {
          const aRawData = a.raw_data ? JSON.parse(a.raw_data) : null
          const bRawData = b.raw_data ? JSON.parse(b.raw_data) : null
          
          if (aRawData && bRawData && aRawData.__original_row_number__ && bRawData.__original_row_number__) {
            return aRawData.__original_row_number__ - bRawData.__original_row_number__
          }
        } catch (error) {
          console.warn('Failed to parse raw_data for brand sorting:', error)
        }
        
        // Fallback to created_at order
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
    }

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
      
      // Use raw_data from first product to determine original structure
      let originalHeaders: string[] = []
      let hasRawData = false
      
      if (batch.products.length > 0 && batch.products[0].raw_data) {
        try {
          const rawData = JSON.parse(batch.products[0].raw_data)
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
      batch.products.forEach(product => {
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
                
                const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`
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
                }
              })
            }
          } catch (error) {
            console.warn('Failed to parse raw_data for product:', product.id)
            // Fallback to default structure
            rowData = {
              name: product.name_sv,
              description: product.description_sv,
              optimized: product.optimized_sv || ''
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
              rowData[`description_${langCode}`] = ''
              if (langCode === 'da' && product.translated_da) {
                rowData[`description_${langCode}`] = product.translated_da
              } else if (langCode === 'no' && product.translated_no) {
                rowData[`description_${langCode}`] = product.translated_no
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
          'Content-Disposition': `attachment; filename="${batch.filename}_export.xlsx"`
        }
      })
    }
    
    if (batch.job_type === 'ui_items' || batch.job_type === 'ui_strings') {
      // Export UI items
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('UI-element')
      
      // Get original locale structure from upload metadata
      let originalLocales: string[] = []
      try {
        if (batch.upload && batch.upload.meta) {
          const metaData = JSON.parse(batch.upload.meta)
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
        batch.ui_items.forEach(item => {
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
      
      // Add headers
      const columns = [
        { header: 'Name', key: 'name', width: 30 }
      ]
      
      // Add locale columns in original order
      originalLocales.forEach(locale => {
        columns.push({ header: locale, key: locale, width: 40 })
      })
      
      worksheet.columns = columns

      // Add data rows
      batch.ui_items.forEach(item => {
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
          'Content-Disposition': `attachment; filename="${batch.filename}_ui_export.xlsx"`
        }
      })
    }
    
    if (batch.job_type === 'brands') {
      // Export brands
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Varumärken')
      
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
      
      // Use raw_data from first brand to determine original structure
      let originalHeaders: string[] = []
      let hasRawData = false
      
      if (batch.brands.length > 0 && batch.brands[0].raw_data) {
        try {
          const rawData = JSON.parse(batch.brands[0].raw_data)
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
          header: 'Kort beskrivning (SV)',
          key: 'short_sv',
          width: 50
        })
        
        headers.push({
          header: 'Lång beskrivning HTML (SV)',
          key: 'long_html_sv',
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
            header: `Kort beskrivning (${locale})`,
            key: `short_${langCode}`,
            width: 50
          })
          headers.push({
            header: `Lång beskrivning HTML (${locale})`,
            key: `long_html_${langCode}`,
            width: 50
          })
        })
      } else {
        // Fallback to default structure
        headers = [
          { header: 'Varumärkesnamn', key: 'name', width: 30 },
          { header: 'Beskrivning (SV)', key: 'description', width: 50 },
          { header: 'Kort beskrivning (SV)', key: 'short_sv', width: 50 },
          { header: 'Lång beskrivning HTML (SV)', key: 'long_html_sv', width: 50 }
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
            header: `Kort beskrivning (${locale})`,
            key: `short_${langCode}`,
            width: 50
          })
          headers.push({
            header: `Lång beskrivning HTML (${locale})`,
            key: `long_html_${langCode}`,
            width: 50
          })
        })
      }
      
      worksheet.columns = headers

      // Add data rows
      batch.brands.forEach(brand => {
        let rowData: any = {}
        
        if (hasRawData && brand.raw_data) {
          try {
            // Start with original raw data
            rowData = JSON.parse(brand.raw_data)
            
            // Remove internal fields that shouldn't be exported
            delete rowData['__original_row_number__']
            
            // Add optimized text
            rowData['short_sv'] = brand.short_sv || ''
            rowData['long_html_sv'] = brand.long_html_sv || ''
            
            // Override with translations where available
            if (brand.translations) {
              const translations = JSON.parse(brand.translations)
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
                if (translations[langCode]) {
                  rowData[`short_${langCode}`] = translations[langCode].short || ''
                  rowData[`long_html_${langCode}`] = translations[langCode].long_html || ''
                } else {
                  rowData[`short_${langCode}`] = ''
                  rowData[`long_html_${langCode}`] = ''
                }
              })
            } else {
              // No translations available
              translationLanguages.forEach(langCode => {
                rowData[`short_${langCode}`] = ''
                rowData[`long_html_${langCode}`] = ''
              })
            }
          } catch (error) {
            console.warn('Failed to parse raw_data for brand:', brand.id)
            // Fallback to default structure
            rowData = {
              name: brand.name_sv,
              description: brand.description_sv,
              short_sv: brand.short_sv || '',
              long_html_sv: brand.long_html_sv || ''
            }
          }
        } else {
          // Fallback to default structure
          rowData = {
            name: brand.name_sv,
            description: brand.description_sv,
            short_sv: brand.short_sv || '',
            long_html_sv: brand.long_html_sv || ''
          }
          
          // Add translations from the new translations field
          if (brand.translations) {
            try {
              const translations = JSON.parse(brand.translations)
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
                if (translations[langCode]) {
                  rowData[`short_${langCode}`] = translations[langCode].short || ''
                  rowData[`long_html_${langCode}`] = translations[langCode].long_html || ''
                } else {
                  rowData[`short_${langCode}`] = ''
                  rowData[`long_html_${langCode}`] = ''
                }
              })
            } catch (error) {
              console.warn('Failed to parse translations for brand:', brand.id)
              translationLanguages.forEach(langCode => {
                rowData[`short_${langCode}`] = ''
                rowData[`long_html_${langCode}`] = ''
              })
            }
          } else {
            // No translations available
            translationLanguages.forEach(langCode => {
              rowData[`short_${langCode}`] = ''
              rowData[`long_html_${langCode}`] = ''
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
          'Content-Disposition': `attachment; filename="${batch.filename}_brands_export.xlsx"`
        }
      })
    }
    
    // If no job_type matches, return error
    return NextResponse.json(
      { error: 'Unsupported job type for export' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}