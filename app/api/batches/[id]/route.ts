import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params

    // Get batch with products or UI items (only non-deleted)
    const batch = await prisma.productBatch.findUnique({
      where: { 
        id: batchId,
        deleted_at: null // Only find non-deleted batches
      },
      select: {
        id: true,
        filename: true,
        upload_id: true,
        upload_date: true,
        total_products: true,
        job_type: true,
        status: true,
        created_at: true,
        updated_at: true,
        targetLanguages: true,
        products: {
          select: {
            id: true,
            name_sv: true,
            description_sv: true,
            attributes: true,
            tone_hint: true,
            raw_data: true,
            optimized_sv: true,
            translated_da: true,
            translated_nb: true,
            translated_no: true,
            translated_en: true,
            translated_de: true,
            translated_fr: true,
            translated_es: true,
            translated_it: true,
            translated_pt: true,
            translated_nl: true,
            translated_pl: true,
            translated_ru: true,
            translated_fi: true,
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
      where: { 
        id: batchId,
        deleted_at: null // Only find non-deleted batches
      },
      select: { id: true, status: true, filename: true, total_products: true }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    // Allow deletion of any batch regardless of status

    // Soft delete the batch
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { 
        deleted_at: new Date(),
        updated_at: new Date()
      }
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
