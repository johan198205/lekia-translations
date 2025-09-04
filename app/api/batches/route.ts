import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createBatchSchema = z.object({
  upload_id: z.string().min(1),
  selected_product_ids: z.array(z.string()).min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { upload_id, selected_product_ids } = createBatchSchema.parse(body)

    // Get upload info
    const upload = await prisma.upload.findUnique({
      where: { id: upload_id }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Create batch
    const batch = await prisma.productBatch.create({
      data: {
        upload_id: upload_id,
        filename: upload.filename,
        upload_date: upload.upload_date,
        total_products: selected_product_ids.length,
        status: 'pending'
      }
    })

    // Update selected products with batch_id
    await prisma.product.updateMany({
      where: {
        id: { in: selected_product_ids },
        upload_id: upload_id
      },
      data: {
        batch_id: batch.id
      }
    })

    return NextResponse.json({
      id: batch.id,
      upload_id: batch.upload_id,
      filename: batch.filename,
      total_products: batch.total_products,
      status: batch.status
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const batches = await prisma.productBatch.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        products: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json(batches)
  } catch (error) {
    console.error('Get batches error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
