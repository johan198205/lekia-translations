import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params

    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        filename: true,
        job_type: true,
        meta: true
      }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Parse metadata
    let metadata = null
    if (upload.meta) {
      try {
        metadata = JSON.parse(upload.meta)
      } catch (error) {
        console.warn('Failed to parse upload metadata:', error)
      }
    }

    return NextResponse.json({
      id: upload.id,
      filename: upload.filename,
      job_type: upload.job_type,
      meta: metadata
    })
  } catch (error) {
    console.error('Get upload metadata error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
