import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const uploads = await prisma.upload.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        products: {
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

    // Beräkna antal produkter kvar att optimera för varje upload
    const uploadsWithStats = uploads.map(upload => {
      const totalProducts = upload.products.length
      const productsRemaining = upload.products.filter(p => p.status === 'pending').length
      
      return {
        id: upload.id,
        filename: upload.filename,
        upload_date: upload.upload_date,
        total_products: totalProducts,
        products_remaining: productsRemaining,
        batches_count: upload.batches.length,
        job_type: upload.job_type,
        created_at: upload.created_at,
        updated_at: upload.updated_at
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
