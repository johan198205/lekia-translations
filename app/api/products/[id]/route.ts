import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const body = await request.json()

    // Validate input - allow updating description_sv, description_no, and optimized_sv
    const { description_sv, description_no, optimized_sv } = body

    if (typeof description_sv !== 'string' && description_sv !== undefined) {
      return NextResponse.json(
        { error: 'description_sv must be a string' },
        { status: 400 }
      )
    }

    if (typeof description_no !== 'string' && description_no !== undefined) {
      return NextResponse.json(
        { error: 'description_no must be a string' },
        { status: 400 }
      )
    }

    if (typeof optimized_sv !== 'string' && optimized_sv !== undefined) {
      return NextResponse.json(
        { error: 'optimized_sv must be a string' },
        { status: 400 }
      )
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {}
    if (description_sv !== undefined) {
      updateData.description_sv = description_sv
    }
    if (description_no !== undefined) {
      updateData.translated_no = description_no // Map to translated_no field in DB
    }
    if (optimized_sv !== undefined) {
      updateData.optimized_sv = optimized_sv
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: {
        id: true,
        name_sv: true,
        description_sv: true,
        optimized_sv: true,
        translated_da: true,
        translated_no: true,
        status: true,
        updated_at: true
      }
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Update product error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
