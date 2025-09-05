import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optimizeSv } from '@/lib/llm/adapter'

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params
    
    // Get prompt settings and selected product indices from client
    const body = await request.json().catch(() => ({}))
    const clientPromptSettings = body.clientPromptSettings || {}
    const selectedIndices: number[] = body.selectedIndices || []
    
    console.log('[OPTIMIZE] Received body:', JSON.stringify(body, null, 2));
    console.log('[OPTIMIZE] selectedIndices:', selectedIndices);
    console.log('[OPTIMIZE] selectedIndices length:', selectedIndices.length);

    // Verify batch exists
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

    console.log(`[OPTIMIZE] Batch found: ${batch.id}, job_type: ${batch.job_type}`);
    console.log(`[OPTIMIZE] Products count: ${batch.products?.length || 0}`);
    console.log(`[OPTIMIZE] UI items count: ${batch.ui_items?.length || 0}`);

    // Update batch status
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'running' }
    })

    let productsToOptimize: any[] = []
    
    if (batch.job_type === 'product_texts') {
      // Process optimization jobs for products
      productsToOptimize = selectedIndices.length > 0 
        ? selectedIndices.map(index => batch.products[index]).filter(Boolean)
        : batch.products;
      
      console.log(`[OPTIMIZE] Starting optimization for ${productsToOptimize.length} products`);
      console.log(`[OPTIMIZE] Selected indices:`, selectedIndices);
      console.log(`[OPTIMIZE] Batch products count:`, batch.products.length);
      console.log(`[OPTIMIZE] Products to optimize:`, productsToOptimize.map(p => ({ id: p.id, name: p.name_sv, index: batch.products.findIndex(bp => bp.id === p.id) })));
    } else {
      // For UI elements, we don't need optimization - they're already ready
      console.log(`[OPTIMIZE] UI elements batch - no optimization needed, marking as completed`);
      
      // Mark all UI items as completed
      await prisma.uIItem.updateMany({
        where: { 
          batch_id: batchId,
          status: 'pending'
        },
        data: { status: 'completed' }
      })

      // Mark batch as completed
      await prisma.productBatch.update({
        where: { id: batchId },
        data: { status: 'completed' }
      })

      return NextResponse.json({ message: 'UI elements batch completed' })
    }
    
    // Process each product directly
    for (let i = 0; i < productsToOptimize.length; i++) {
      const product = productsToOptimize[i]
      try {
        console.log(`[OPTIMIZE] Processing product: ${product.name_sv}`);
        
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
        }, clientPromptSettings.optimize)
        
        console.log(`[OPTIMIZE] Product ${product.name_sv} optimized successfully, length: ${optimizedText.length}`);
        
        // Update product with optimized text
        await prisma.product.update({
          where: { id: product.id },
          data: {
            optimized_sv: optimizedText,
            status: 'optimized'
          }
        })
        
        // Emit progress event after each product completion
        const done = i + 1
        const total = productsToOptimize.length
        const percent = Math.round((done / total) * 100)
        
        console.log(`[OPTIMIZE] Progress: ${done}/${total} (${percent}%)`)
        
      } catch (error) {
        console.error(`[OPTIMIZE] Error optimizing product ${product.name_sv}:`, error)
        await prisma.product.update({
          where: { id: product.id },
          data: {
            status: 'error',
            error_message: 'Optimization failed'
          }
        })
        
        // Still emit progress even for failed products
        const done = i + 1
        const total = productsToOptimize.length
        const percent = Math.round((done / total) * 100)
        
        console.log(`[OPTIMIZE] Progress: ${done}/${total} (${percent}%) - product failed`)
      }
    }

    return NextResponse.json({
      message: 'Optimization started',
      batchId,
      productsCount: productsToOptimize.length
    })
  } catch (error) {
    console.error('Optimize error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
