import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params

    // Get all brands from this upload that are not in any batch
    const brands = await prisma.brand.findMany({
      where: {
        upload_id: uploadId,
        batch_id: null
      },
      orderBy: { created_at: 'asc' }
    })

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Get brands error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
