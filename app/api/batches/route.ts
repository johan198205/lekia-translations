import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createBatchSchema = z.object({
  filename: z.string().min(1),
  products: z.number().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, products } = createBatchSchema.parse(body)

    // Create batch
    const batch = await prisma.productBatch.create({
      data: {
        filename,
        upload_date: new Date(),
        total_products: products,
        status: 'pending'
      }
    })

    // Products are already created with correct batch_id in upload route
    // No need to update them here

    return NextResponse.json({
      id: batch.id,
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
