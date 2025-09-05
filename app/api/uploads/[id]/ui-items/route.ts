import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params

    // Hämta upload med UI-element som behöver bearbetas (endast pending)
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        ui_items: {
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

    // Returnera upload-info och UI-element
    return NextResponse.json({
      upload: {
        id: upload.id,
        filename: upload.filename,
        upload_date: upload.upload_date,
        total_products: upload.total_products
      },
      uiItems: upload.ui_items.map(item => ({
        id: item.id,
        name: item.name,
        values: JSON.parse(item.values),
        status: item.status,
        batch_id: item.batch_id
      }))
    })
  } catch (error) {
    console.error('Get upload UI items error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
