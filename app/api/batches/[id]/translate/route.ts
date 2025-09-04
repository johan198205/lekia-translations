import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { translateQueue } from '@/lib/queue'
import { translateTo } from '@/lib/llm/adapter'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params
    const { languages } = await request.json()

    if (!languages || !Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json(
        { error: 'Languages array is required' },
        { status: 400 }
      )
    }

    // Verify batch exists and has optimized products
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: { 
        products: {
          where: { status: 'optimized' }
        }
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    if (batch.products.length === 0) {
      return NextResponse.json(
        { error: 'No optimized products found' },
        { status: 400 }
      )
    }

    // Add translation jobs to queue
    for (const product of batch.products) {
      for (const lang of languages) {
        await translateQueue.add('translate', {
          batchId,
          productId: product.id,
          language: lang,
          optimizedText: product.optimized_sv
        })
      }
    }

    // Start processing (simulate async processing)
    setTimeout(async () => {
      await translateQueue.process('translate', async (job) => {
        const { productId, language, optimizedText } = job.data
        
        try {
          // Use LLM adapter for translation
          const translatedText = await translateTo({
            text: optimizedText,
            target: language as 'da' | 'no'
          })
          
          // Update product with translated text
          const updateData: any = { status: 'completed' }
          if (language === 'da') {
            updateData.translated_da = translatedText
          } else if (language === 'no') {
            updateData.translated_no = translatedText
          }
          
          await prisma.product.update({
            where: { id: productId },
            data: updateData
          })
        } catch (error) {
          console.error('Translation error for product:', productId, error)
          await prisma.product.update({
            where: { id: productId },
            data: {
              status: 'error',
              error_message: 'Translation failed'
            }
          })
        }
      })
    }, 100)

    return NextResponse.json({
      message: 'Translation started',
      batchId,
      productsCount: batch.products.length,
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
