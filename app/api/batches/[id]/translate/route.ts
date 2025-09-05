import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { translateQueue } from '@/lib/queue'
import { translateTo } from '@/lib/llm/adapter'
import { cleanTranslationFormat } from '@/lib/format-guard'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params
    const { languages, selectedProductIds, clientPromptSettings } = await request.json()

    if (!languages || !Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json(
        { error: 'Languages array is required' },
        { status: 400 }
      )
    }

    // Verify batch exists and has optimized products
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: { products: true }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Filter products that have optimized_sv and are selected
    const productsToTranslate = batch.products.filter(product => {
      const hasOptimizedSv = product.optimized_sv && product.optimized_sv.trim()
      const isSelected = !selectedProductIds || selectedProductIds.length === 0 || 
                        selectedProductIds.includes(product.id)
      return hasOptimizedSv && isSelected
    })

    if (productsToTranslate.length === 0) {
      return NextResponse.json(
        { error: 'No optimized products found for translation' },
        { status: 400 }
      )
    }

    console.log(`[TRANSLATE] Starting translation for ${productsToTranslate.length} products`)
    console.log(`[TRANSLATE] Languages:`, languages)

    // Update batch status
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'running' }
    })

    // Process each product directly (like optimize does) - but return immediately for progress tracking
    // Start async processing
    setTimeout(async () => {
      for (let i = 0; i < productsToTranslate.length; i++) {
        const product = productsToTranslate[i]
        
        for (const language of languages) {
          try {
            console.log(`[TRANSLATE] Processing product: ${product.name_sv} -> ${language}`)
            
            // Set status to translating
            await prisma.product.update({
              where: { id: product.id },
              data: { status: 'translating' }
            })
            
            // Use LLM adapter for translation with client prompt settings
            const translatedText = await translateTo({
              text: product.optimized_sv!,
              target: language as 'da' | 'no'
            })
            
            // Apply format guard to clean up any extra # characters
            const cleanedText = cleanTranslationFormat(product.optimized_sv!, translatedText)
            
            console.log(`[TRANSLATE] Product ${product.name_sv} translated to ${language} successfully`)
            
            // Update product with translated text
            const updateData: any = {}
            if (language === 'da') {
              updateData.translated_da = cleanedText
            } else if (language === 'no') {
              updateData.translated_no = cleanedText
            }
            
            // Set status based on translation progress
            const hasDa = language === 'da' ? true : (product.translated_da && product.translated_da.trim())
            const hasNo = language === 'no' ? true : (product.translated_no && product.translated_no.trim())
            
            if (hasDa && hasNo) {
              // Both languages translated - mark as completed
              updateData.status = 'completed'
            } else if (hasDa || hasNo) {
              // One language translated - keep as optimized (will be counted as progress)
              updateData.status = 'optimized'
            } else {
              // No translations yet - should not happen but keep as optimized
              updateData.status = 'optimized'
            }
            
            await prisma.product.update({
              where: { id: product.id },
              data: updateData
            })
            
          } catch (error) {
            console.error(`[TRANSLATE] Error translating product ${product.name_sv} to ${language}:`, error)
            await prisma.product.update({
              where: { id: product.id },
              data: {
                status: 'error',
                error_message: `Translation to ${language} failed`
              }
            })
          }
        }
      }
    }, 100)

    return NextResponse.json({
      message: 'Translation started',
      batchId,
      productsCount: productsToTranslate.length,
      languages
    })
  } catch (error) {
    console.error('Translate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
