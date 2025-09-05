import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params

    // Check if upload exists
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        batches: {
          select: { id: true, status: true }
        }
      }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Check if any batches are still processing
    const processingBatches = upload.batches.filter(batch => 
      batch.status === 'running' || batch.status === 'pending'
    )

    if (processingBatches.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete upload with processing batches' },
        { status: 400 }
      )
    }

    // Delete upload and cascade to related items
    await prisma.upload.delete({
      where: { id: uploadId }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
