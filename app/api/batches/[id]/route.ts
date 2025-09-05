import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params

    // Get batch with products or UI items
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
        },
        ui_items: {
          select: {
            id: true,
            name: true,
            values: true,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params

    // Check if batch exists and get its status
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      select: { id: true, status: true }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of processing or exported batches
    if (batch.status === 'running' || batch.status === 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete batch that is currently processing' },
        { status: 400 }
      )
    }

    // Delete batch and cascade to related items
    await prisma.productBatch.delete({
      where: { id: batchId }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
