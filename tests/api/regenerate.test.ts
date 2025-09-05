import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/batches/[id]/regenerate/route'
import { prisma } from '@/lib/prisma'
import { optimizeSv } from '@/lib/llm/adapter'

// Mock the LLM adapter
vi.mock('@/lib/llm/adapter', () => ({
  optimizeSv: vi.fn()
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    productBatch: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    product: {
      update: vi.fn()
    }
  }
}))

const mockOptimizeSv = vi.mocked(optimizeSv)
const mockPrisma = vi.mocked(prisma)

describe('/api/batches/[id]/regenerate', () => {
  const mockBatchId = 'test-batch-id'
  const mockProductId1 = 'product-1'
  const mockProductId2 = 'product-2'

  const mockBatch = {
    id: mockBatchId,
    filename: 'test.xlsx',
    upload_date: new Date(),
    total_products: 2,
    status: 'completed',
    created_at: new Date(),
    updated_at: new Date(),
    products: [
      {
        id: mockProductId1,
        name_sv: 'Test Product 1',
        description_sv: 'Test description 1',
        attributes: 'Test attributes 1',
        tone_hint: 'professional',
        optimized_sv: 'Old optimized text 1',
        translated_da: null,
        translated_no: null,
        status: 'optimized',
        error_message: null,
        batch_id: mockBatchId,
        upload_id: 'upload-1',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: mockProductId2,
        name_sv: 'Test Product 2',
        description_sv: 'Test description 2',
        attributes: 'Test attributes 2',
        tone_hint: 'friendly',
        optimized_sv: 'Old optimized text 2',
        translated_da: null,
        translated_no: null,
        status: 'optimized',
        error_message: null,
        batch_id: mockBatchId,
        upload_id: 'upload-1',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]
  }

  const mockPromptSettings = {
    optimize: {
      system: 'Test system prompt',
      headers: '# Test\n## Test',
      maxWords: 120,
      temperature: 0.2,
      model: 'gpt-4o-mini',
      toneDefault: 'professional'
    },
    translate: {
      system: 'Test translate prompt',
      temperature: 0,
      model: 'gpt-4o-mini'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    mockPrisma.productBatch.findUnique.mockResolvedValue(mockBatch)
    mockPrisma.productBatch.update.mockResolvedValue(mockBatch)
    mockPrisma.product.update.mockResolvedValue(mockBatch.products[0])
    mockOptimizeSv.mockResolvedValue('New optimized text')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should regenerate all products when no itemIds provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test-batch-id/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        clientPromptSettings: mockPromptSettings
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: mockBatchId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Regenerated 2 products')
    expect(data.batchId).toBe(mockBatchId)

    // Verify batch status was updated
    expect(mockPrisma.productBatch.update).toHaveBeenCalledWith({
      where: { id: mockBatchId },
      data: { status: 'running' }
    })

    // Verify each product was processed
    expect(mockOptimizeSv).toHaveBeenCalledTimes(2)
    expect(mockOptimizeSv).toHaveBeenCalledWith(
      {
        nameSv: 'Test Product 1',
        descriptionSv: 'Test description 1',
        attributes: 'Test attributes 1',
        toneHint: 'professional'
      },
      mockPromptSettings.optimize
    )
    expect(mockOptimizeSv).toHaveBeenCalledWith(
      {
        nameSv: 'Test Product 2',
        descriptionSv: 'Test description 2',
        attributes: 'Test attributes 2',
        toneHint: 'friendly'
      },
      mockPromptSettings.optimize
    )

    // Verify products were updated with new optimized text
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: mockProductId1 },
      data: {
        optimized_sv: 'New optimized text',
        status: 'optimized'
      }
    })
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: mockProductId2 },
      data: {
        optimized_sv: 'New optimized text',
        status: 'optimized'
      }
    })
  })

  it('should regenerate only selected products when itemIds provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test-batch-id/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        itemIds: [mockProductId1],
        clientPromptSettings: mockPromptSettings
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: mockBatchId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Regenerated 1 products')

    // Verify only one product was processed
    expect(mockOptimizeSv).toHaveBeenCalledTimes(1)
    expect(mockOptimizeSv).toHaveBeenCalledWith(
      {
        nameSv: 'Test Product 1',
        descriptionSv: 'Test description 1',
        attributes: 'Test attributes 1',
        toneHint: 'professional'
      },
      mockPromptSettings.optimize
    )
  })

  it('should return 404 when batch not found', async () => {
    mockPrisma.productBatch.findUnique.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/batches/nonexistent-batch/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        clientPromptSettings: mockPromptSettings
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent-batch' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Batch not found')
  })

  it('should handle optimization errors gracefully', async () => {
    mockOptimizeSv.mockRejectedValueOnce(new Error('LLM API error'))

    const request = new NextRequest('http://localhost:3000/api/batches/test-batch-id/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        clientPromptSettings: mockPromptSettings
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: mockBatchId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify error handling - product should be marked as error
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: mockProductId1 },
      data: {
        status: 'error',
        error_message: 'Regeneration failed'
      }
    })
  })

  it('should validate request body schema', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test-batch-id/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        itemIds: 'invalid-array', // Should be array
        clientPromptSettings: 'invalid-object' // Should be object
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: mockBatchId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request data')
    expect(data.details).toBeDefined()
  })

  it('should work without clientPromptSettings', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test-batch-id/regenerate', {
      method: 'POST',
      body: JSON.stringify({})
    })

    const response = await POST(request, { params: Promise.resolve({ id: mockBatchId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Regenerated 2 products')

    // Should still call optimizeSv but with undefined prompt settings
    expect(mockOptimizeSv).toHaveBeenCalledTimes(2)
  })

  it('should handle empty itemIds array', async () => {
    const request = new NextRequest('http://localhost:3000/api/batches/test-batch-id/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        itemIds: [],
        clientPromptSettings: mockPromptSettings
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: mockBatchId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Regenerated 2 products') // Should process all products when empty array

    expect(mockOptimizeSv).toHaveBeenCalledTimes(2)
  })
})
