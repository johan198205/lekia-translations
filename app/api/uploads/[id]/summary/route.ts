import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Verify upload exists and matches job type
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
      console.warn('Failed to load translation languages for summary:', error)
    }

    if (jobType === 'product_texts') {
      // Get all products from this upload
      const products = await prisma.product.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { created_at: 'asc' }
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
      const totalRows = products.length
      const optimizedCount = products.filter(p => p.optimized_sv && p.optimized_sv.trim()).length

      // Count translations per language
      const translationCounts: Record<string, number> = {}
      translationLanguages.forEach(lang => {
        translationCounts[lang] = 0
      })

      products.forEach(product => {
        if (product.translations) {
          try {
            const translations = JSON.parse(product.translations)
            translationLanguages.forEach(lang => {
              if (translations[lang] && translations[lang].trim()) {
                translationCounts[lang]++
              }
            })
          } catch (error) {
            // Fallback to legacy fields
            translationLanguages.forEach(lang => {
              if (lang === 'da' && product.translated_da && product.translated_da.trim()) {
                translationCounts[lang]++
              } else if (lang === 'no' && product.translated_no && product.translated_no.trim()) {
                translationCounts[lang]++
              }
            })
          }
        } else {
          // Fallback to legacy fields
          translationLanguages.forEach(lang => {
            if (lang === 'da' && product.translated_da && product.translated_da.trim()) {
              translationCounts[lang]++
            } else if (lang === 'no' && product.translated_no && product.translated_no.trim()) {
              translationCounts[lang]++
            }
          })
        }
      })

      return NextResponse.json({
        totalRows,
        optimizedCount,
        translationCounts,
        translationLanguages
      })
    } else {
      // Get all UI items from this upload
      const uiItems = await prisma.uIItem.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { created_at: 'asc' }
      })

      // Deduplicate by name, keep most recently updated
      const deduplicatedItems = uiItems.reduce((acc, item) => {
        const existing = acc.find(i => i.name === item.name)
        if (!existing || item.updated_at > existing.updated_at) {
          const filtered = acc.filter(i => i.name !== item.name)
          return [...filtered, item]
        }
        return acc
      }, [] as typeof uiItems)

      const totalRows = deduplicatedItems.length
      const completedCount = deduplicatedItems.filter(item => item.status === 'completed').length

      // Count translations per language for UI items
      const translationCounts: Record<string, number> = {}
      translationLanguages.forEach(lang => {
        translationCounts[lang] = 0
      })

      deduplicatedItems.forEach(item => {
        try {
          const values = JSON.parse(item.values)
          translationLanguages.forEach(lang => {
            if (values[lang] && values[lang].trim()) {
              translationCounts[lang]++
            }
          })
        } catch (error) {
          console.warn('Failed to parse UI item values:', error)
        }
      })

      return NextResponse.json({
        totalRows,
        optimizedCount: completedCount, // For UI items, use completed count as "optimized"
        translationCounts,
        translationLanguages
      })
    }
  } catch (error) {
    console.error('Get upload summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
