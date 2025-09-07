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
      where: { id: uploadId }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Delete all related data in correct order to avoid foreign key constraints
    // First delete all products
    await prisma.product.deleteMany({
      where: { upload_id: uploadId }
    })

    // Then delete all UI items
    await prisma.uIItem.deleteMany({
      where: { upload_id: uploadId }
    })

    // Then delete all batches
    await prisma.productBatch.deleteMany({
      where: { upload_id: uploadId }
    })

    // Finally delete the upload
    await prisma.upload.delete({
      where: { id: uploadId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}