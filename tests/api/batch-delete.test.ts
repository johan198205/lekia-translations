import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/batches/[id]/route'
import { prisma } from '@/lib/prisma'

describe('Batch Delete API', () => {
  let testBatchId: string
  let testUploadId: string

  beforeEach(async () => {
    // Create a test upload
    const upload = await prisma.upload.create({
      data: {
        filename: 'test-upload.xlsx',
        upload_date: new Date(),
        total_products: 5,
        job_type: 'product_texts'
      }
    })
    testUploadId = upload.id

    // Create a test batch
    const batch = await prisma.productBatch.create({
      data: {
        upload_id: testUploadId,
        filename: 'test-batch.xlsx',
        upload_date: new Date(),
        total_products: 5,
        job_type: 'product_texts',
        status: 'completed'
      }
    })
    testBatchId = batch.id
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.productBatch.deleteMany({
      where: { upload_id: testUploadId }
    })
    await prisma.upload.deleteMany({
      where: { id: testUploadId }
    })
  })

  it('should soft delete a batch successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test')
    const response = await DELETE(request, {
      params: Promise.resolve({ id: testBatchId })
    })

    expect(response.status).toBe(200)
    
    const result = await response.json()
    expect(result).toEqual({ ok: true })

    // Verify batch is soft deleted
    const deletedBatch = await prisma.productBatch.findUnique({
      where: { id: testBatchId }
    })
    expect(deletedBatch?.deleted_at).not.toBeNull()
  })

  it('should prevent deletion of running batch', async () => {
    // Update batch status to running
    await prisma.productBatch.update({
      where: { id: testBatchId },
      data: { status: 'running' }
    })

    const request = new NextRequest('http://localhost:3000/api/batches/test')
    const response = await DELETE(request, {
      params: Promise.resolve({ id: testBatchId })
    })

    expect(response.status).toBe(409)
    
    const result = await response.json()
    expect(result.error).toBe('Cannot delete batch that is currently processing')

    // Verify batch is not deleted
    const batch = await prisma.productBatch.findUnique({
      where: { id: testBatchId }
    })
    expect(batch?.deleted_at).toBeNull()
  })

  it('should return 404 for non-existent batch', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test')
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'non-existent-id' })
    })

    expect(response.status).toBe(404)
    
    const result = await response.json()
    expect(result.error).toBe('Batch not found')
  })

  it('should return 404 for already deleted batch', async () => {
    // Soft delete the batch first
    await prisma.productBatch.update({
      where: { id: testBatchId },
      data: { deleted_at: new Date() }
    })

    const request = new NextRequest('http://localhost:3000/api/batches/test')
    const response = await DELETE(request, {
      params: Promise.resolve({ id: testBatchId })
    })

    expect(response.status).toBe(404)
    
    const result = await response.json()
    expect(result.error).toBe('Batch not found')
  })
})
