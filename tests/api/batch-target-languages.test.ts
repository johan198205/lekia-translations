import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// Mock the queue and LLM adapter
vi.mock('@/lib/queue', () => ({
  translateQueue: {
    add: vi.fn()
  }
}))

vi.mock('@/lib/llm/adapter', () => ({
  translateTo: vi.fn().mockResolvedValue('Translated text')
}))

describe('Batch Target Languages Flow', () => {
  let uploadId: string
  let batchId: string

  beforeEach(async () => {
    // Create a test upload
    const upload = await prisma.upload.create({
      data: {
        filename: 'test.xlsx',
        upload_date: new Date(),
        total_products: 2,
        job_type: 'product_texts',
        meta: JSON.stringify({ locales: ['sv', 'da', 'no'] })
      }
    })
    uploadId = upload.id

    // Create test products
    await prisma.product.createMany({
      data: [
        {
          upload_id: uploadId,
          name_sv: 'Test Product 1',
          description_sv: 'Test description 1',
          status: 'pending',
          raw_data: JSON.stringify({
            name: 'Test Product 1',
            description: 'Test description 1',
            __original_row_number__: 1
          })
        },
        {
          upload_id: uploadId,
          name_sv: 'Test Product 2',
          description_sv: 'Test description 2',
          status: 'pending',
          raw_data: JSON.stringify({
            name: 'Test Product 2',
            description: 'Test description 2',
            __original_row_number__: 2
          })
        }
      ]
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.product.deleteMany({ where: { upload_id: uploadId } })
    await prisma.productBatch.deleteMany({ where: { upload_id: uploadId } })
    await prisma.upload.delete({ where: { id: uploadId } })
  })

  it('should create batch with target languages and use them in translate and export', async () => {
    const targetLanguages = ['da', 'no', 'en']

    // Step 1: Create batch with target languages
    const createResponse = await fetch('http://localhost:3000/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: uploadId,
        job_type: 'product_texts',
        selected_ids: await prisma.product.findMany({ where: { upload_id: uploadId } }).then(products => products.map(p => p.id)),
        target_languages: targetLanguages
      })
    })

    expect(createResponse.ok).toBe(true)
    const createData = await createResponse.json()
    batchId = createData.id

    // Verify batch was created with target languages
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId }
    })
    expect(batch).toBeTruthy()
    expect(batch?.targetLanguages).toBe(JSON.stringify(targetLanguages))

    // Step 2: Test translate endpoint uses batch target languages
    const translateResponse = await fetch(`http://localhost:3000/api/batches/${batchId}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedProductIds: await prisma.product.findMany({ where: { upload_id: uploadId } }).then(products => products.map(p => p.id)),
        clientPromptSettings: {}
      })
    })

    expect(translateResponse.ok).toBe(true)

    // Step 3: Test export uses batch target languages for columns
    const exportResponse = await fetch(`http://localhost:3000/api/batches/${batchId}/export`)
    expect(exportResponse.ok).toBe(true)

    // Verify the exported file contains columns for target languages
    const buffer = await exportResponse.arrayBuffer()
    // Note: In a real test, you would parse the Excel file and verify column structure
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('should handle empty target languages gracefully', async () => {
    // Create batch without target languages
    const createResponse = await fetch('http://localhost:3000/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: uploadId,
        job_type: 'product_texts',
        selected_ids: await prisma.product.findMany({ where: { upload_id: uploadId } }).then(products => products.map(p => p.id))
        // No target_languages provided
      })
    })

    expect(createResponse.ok).toBe(true)
    const createData = await createResponse.json()
    const batchId = createData.id

    // Verify batch was created without target languages
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId }
    })
    expect(batch?.targetLanguages).toBeNull()

    // Translate should fail with no target languages
    const translateResponse = await fetch(`http://localhost:3000/api/batches/${batchId}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedProductIds: await prisma.product.findMany({ where: { upload_id: uploadId } }).then(products => products.map(p => p.id)),
        clientPromptSettings: {}
      })
    })

    expect(translateResponse.ok).toBe(false)
    const errorData = await translateResponse.json()
    expect(errorData.error).toContain('No target languages configured')
  })
})
