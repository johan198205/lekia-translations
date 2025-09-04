import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params

    // Get batch with products
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: { 
        products: {
          select: {
            id: true,
            name_sv: true,
            description_sv: true,
            attributes: true,
            tone_hint: true,
            optimized_sv: true,
            translated_da: true,
            translated_no: true,
            status: true,
            error_message: true
          }
        }
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(batch)
  } catch (error) {
    console.error('Get batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
