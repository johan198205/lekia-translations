import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params
    const { searchParams } = new URL(request.url)
    const jobType = searchParams.get('jobType') as 'product_texts' | 'ui_strings'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    if (!jobType) {
      return NextResponse.json(
        { error: 'jobType parameter is required' },
        { status: 400 }
      )
    }

    // Verify upload exists and matches job type
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    if (upload.job_type !== jobType) {
      return NextResponse.json(
        { error: 'Upload job type mismatch' },
        { status: 400 }
      )
    }

    const skip = (page - 1) * pageSize

    if (jobType === 'product_texts') {
      // Get all products from this upload, with deduplication
      // Prefer products with the latest updated_at for deduplication
      const products = await prisma.product.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          batch: {
            select: {
              id: true,
              filename: true,
              created_at: true
            }
          }
        }
      })

      // No deduplication needed - each product has a unique ID
      // If there are duplicates in the Excel file, they should be shown as separate rows
      return NextResponse.json({
        items: products,
        total: products.length,
        page,
        pageSize,
        hasMore: products.length === pageSize
      })
    } else {
      // Get all UI items from this upload
      const uiItems = await prisma.uIItem.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          batch: {
            select: {
              id: true,
              filename: true,
              created_at: true
            }
          }
        }
      })

      // No deduplication needed - each UI item has a unique ID
      return NextResponse.json({
        items: uiItems,
        total: uiItems.length,
        page,
        pageSize,
        hasMore: uiItems.length === pageSize
      })
    }
  } catch (error) {
    console.error('Get upload items error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
