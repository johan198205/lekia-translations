import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobType = searchParams.get('jobType') as 'product_texts' | 'ui_strings' | null

    const whereClause = jobType ? { job_type: jobType } : {}

    const uploads = await prisma.upload.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: {
        products: {
          select: {
            id: true,
            status: true,
            batch_id: true
          }
        },
        ui_items: {
          select: {
            id: true,
            status: true,
            batch_id: true
          }
        },
        batches: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    // Beräkna antal produkter/UI-element kvar att bearbeta för varje upload
    const uploadsWithStats = uploads.map(upload => {
      if (upload.job_type === 'product_texts') {
        const totalProducts = upload.products.length
        const productsRemaining = upload.products.filter(p => p.status === 'pending').length
        
        // Parse tokens from meta
        let tokenCount = 0;
        if (upload.meta) {
          try {
            const meta = JSON.parse(upload.meta);
            if (meta.tokens?.tokens) {
              tokenCount = meta.tokens.tokens.length;
            }
          } catch (error) {
            console.warn('Failed to parse upload meta:', error);
          }
        }

        return {
          id: upload.id,
          filename: upload.filename,
          upload_date: upload.upload_date,
          total_products: totalProducts,
          products_remaining: productsRemaining,
          batches_count: upload.batches.length,
          job_type: upload.job_type,
          created_at: upload.created_at,
          updated_at: upload.updated_at,
          token_count: tokenCount
        }
      } else {
        const totalUIItems = upload.ui_items.length
        const uiItemsRemaining = upload.ui_items.filter(item => item.status === 'pending').length
        
        return {
          id: upload.id,
          filename: upload.filename,
          upload_date: upload.upload_date,
          total_products: totalUIItems,
          products_remaining: uiItemsRemaining,
          batches_count: upload.batches.length,
          job_type: upload.job_type,
          created_at: upload.created_at,
          updated_at: upload.updated_at,
          token_count: 0 // UI items don't have tokens
        }
      }
    })

    return NextResponse.json(uploadsWithStats)
  } catch (error) {
    console.error('Get uploads error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
