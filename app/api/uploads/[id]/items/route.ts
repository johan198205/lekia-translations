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
      // Get all products from this upload first, then sort, then paginate
      const allProducts = await prisma.product.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { created_at: 'asc' },
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
      
      // Sort by original row number if available in raw_data
      allProducts.sort((a, b) => {
        try {
          const aRawData = a.raw_data ? JSON.parse(a.raw_data) : null
          const bRawData = b.raw_data ? JSON.parse(b.raw_data) : null
          
          if (aRawData && bRawData && aRawData.__original_row_number__ && bRawData.__original_row_number__) {
            return aRawData.__original_row_number__ - bRawData.__original_row_number__
          }
        } catch (error) {
          console.warn('Failed to parse raw_data for sorting:', error)
        }
        
        // Fallback to created_at order
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      
      // Apply pagination after sorting
      const products = allProducts.slice(skip, skip + pageSize)

      // No deduplication needed - each product has a unique ID
      // If there are duplicates in the Excel file, they should be shown as separate rows
      return NextResponse.json({
        items: products,
        total: allProducts.length,
        page,
        pageSize,
        hasMore: skip + products.length < allProducts.length
      })
    } else {
      // Get all UI items from this upload first, then paginate
      const allUIItems = await prisma.uIItem.findMany({
        where: {
          upload_id: uploadId
        },
        orderBy: { created_at: 'asc' },
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

      // Apply pagination
      const uiItems = allUIItems.slice(skip, skip + pageSize)

      // No deduplication needed - each UI item has a unique ID
      return NextResponse.json({
        items: uiItems,
        total: allUIItems.length,
        page,
        pageSize,
        hasMore: skip + uiItems.length < allUIItems.length
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
