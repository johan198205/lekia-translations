import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optimizeSv } from '@/lib/llm/adapter'
import { z } from 'zod'

const regenerateSchema = z.object({
  itemIds: z.array(z.string()).optional(),
  clientPromptSettings: z.object({
    optimize: z.object({
      system: z.string(),
      headers: z.string(),
      maxWords: z.number(),
      temperature: z.number(),
      model: z.string(),
      toneDefault: z.string()
    }),
    translate: z.object({
      system: z.string(),
      temperature: z.number(),
      model: z.string()
    })
  }).optional()
})

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params
    
    // Parse and validate request body
    const body = await request.json().catch(() => ({}))
    const { itemIds, clientPromptSettings } = regenerateSchema.parse(body)
    
    console.log('[REGENERATE] Received body:', JSON.stringify(body, null, 2));
    console.log('[REGENERATE] itemIds:', itemIds);

    // Verify batch exists
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

    console.log(`[REGENERATE] Batch found: ${batch.id}, products count: ${batch.products?.length || 0}`);

    // Update batch status
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'running' }
    })

    // Determine which products to regenerate
    const productsToRegenerate = itemIds && itemIds.length > 0
      ? batch.products.filter(p => itemIds.includes(p.id))
      : batch.products;
    
    console.log(`[REGENERATE] Starting regeneration for ${productsToRegenerate.length} products`);
    console.log(`[REGENERATE] Products to regenerate:`, productsToRegenerate.map(p => ({ id: p.id, name: p.name_sv })));
    
    // Process each product directly
    for (let i = 0; i < productsToRegenerate.length; i++) {
      const product = productsToRegenerate[i]
      try {
        console.log(`[REGENERATE] Processing product: ${product.name_sv}`);
        
        // Set status to optimizing
        await prisma.product.update({
          where: { id: product.id },
          data: { status: 'optimizing' }
        })
        
        // Use LLM adapter for optimization with client prompt settings
        const optimizedText = await optimizeSv({
          nameSv: product.name_sv,
          descriptionSv: product.description_sv,
          attributes: product.attributes,
          toneHint: product.tone_hint || undefined
        }, clientPromptSettings?.optimize)
        
        console.log(`[REGENERATE] Product ${product.name_sv} regenerated successfully, length: ${optimizedText.length}`);
        
        // Update product with regenerated text
        await prisma.product.update({
          where: { id: product.id },
          data: {
            optimized_sv: optimizedText,
            status: 'optimized'
          }
        })
        
        // Emit progress event after each product completion
        const done = i + 1
        const total = productsToRegenerate.length
        const percent = Math.round((done / total) * 100)
        
        console.log(`[REGENERATE] Progress: ${done}/${total} (${percent}%)`)
        
      } catch (error) {
        console.error(`[REGENERATE] Error regenerating product ${product.name_sv}:`, error)
        await prisma.product.update({
          where: { id: product.id },
          data: {
            status: 'error',
            error_message: 'Regeneration failed'
          }
        })
        
        // Still emit progress even for failed products
        const done = i + 1
        const total = productsToRegenerate.length
        const percent = Math.round((done / total) * 100)
        
        console.log(`[REGENERATE] Progress: ${done}/${total} (${percent}%) - product failed`)
      }
    }

    // Update batch status to completed
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'completed' }
    })

    return NextResponse.json({
      success: true,
      message: `Regenerated ${productsToRegenerate.length} products`,
      batchId: batchId
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Regenerate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
