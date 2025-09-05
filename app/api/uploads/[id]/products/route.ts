import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params

    // Hämta upload med produkter som behöver optimeras (endast pending)
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        products: {
          where: { status: 'pending' },
          orderBy: { created_at: 'asc' }
        }
      }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Returnera upload-info och produkter
    return NextResponse.json({
      upload: {
        id: upload.id,
        filename: upload.filename,
        upload_date: upload.upload_date,
        total_products: upload.total_products
      },
      products: upload.products.map(product => ({
        id: product.id,
        name_sv: product.name_sv,
        description_sv: product.description_sv,
        attributes: product.attributes,
        tone_hint: product.tone_hint,
        status: product.status,
        batch_id: product.batch_id,
        optimized_sv: product.optimized_sv,
        translated_da: product.translated_da,
        translated_no: product.translated_no,
        error_message: product.error_message
      }))
    })
  } catch (error) {
    console.error('Get upload products error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
