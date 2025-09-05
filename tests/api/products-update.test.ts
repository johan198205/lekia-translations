import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/products/[id]/route'
import { prisma } from '@/lib/prisma'

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

describe('/api/products/[id] PATCH', () => {
  const mockProduct = {
    id: 'test-product-id',
    created_at: new Date(),
    updated_at: new Date(),
    upload_id: 'test-upload-id',
    batch_id: 'test-batch-id',
    name_sv: 'Test Product',
    description_sv: 'Original description',
    attributes: null,
    tone_hint: null,
    optimized_sv: 'Optimized description',
    translated_da: 'Danish translation',
    translated_no: 'Norwegian translation',
    status: 'completed' as const,
    error_message: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should update product description_sv and description_no', async () => {
    // Mock existing product
    vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct)
    
    // Mock successful update
    const updatedProduct = {
      ...mockProduct,
      description_sv: 'Updated description',
      translated_no: 'Updated Norwegian translation'
    }
    vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

    const request = new NextRequest('http://localhost:3000/api/products/test-product-id', {
      method: 'PATCH',
      body: JSON.stringify({
        description_sv: 'Updated description',
        description_no: 'Updated Norwegian translation'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-product-id' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.description_sv).toBe('Updated description')
    expect(data.translated_no).toBe('Updated Norwegian translation')
    
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'test-product-id' },
      data: {
        description_sv: 'Updated description',
        translated_no: 'Updated Norwegian translation'
      },
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
  })

  it('should return 404 if product not found', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/products/non-existent-id', {
      method: 'PATCH',
      body: JSON.stringify({
        description_sv: 'Updated description'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'non-existent-id' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('should return 400 for invalid description_sv type', async () => {
    const request = new NextRequest('http://localhost:3000/api/products/test-product-id', {
      method: 'PATCH',
      body: JSON.stringify({
        description_sv: 123 // Invalid type
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-product-id' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('description_sv must be a string')
  })

  it('should return 400 for invalid description_no type', async () => {
    const request = new NextRequest('http://localhost:3000/api/products/test-product-id', {
      method: 'PATCH',
      body: JSON.stringify({
        description_no: 123 // Invalid type
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-product-id' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('description_no must be a string')
  })

  it('should handle partial updates', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct)
    
    const updatedProduct = {
      ...mockProduct,
      description_sv: 'Updated description only'
    }
    vi.mocked(prisma.product.update).mockResolvedValue(updatedProduct)

    const request = new NextRequest('http://localhost:3000/api/products/test-product-id', {
      method: 'PATCH',
      body: JSON.stringify({
        description_sv: 'Updated description only'
        // description_no not provided
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-product-id' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.description_sv).toBe('Updated description only')
    
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'test-product-id' },
      data: {
        description_sv: 'Updated description only'
      },
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
  })
})
