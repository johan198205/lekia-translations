'use client'

import { useState, useEffect } from 'react'
import ProductDrawer from '../components/ProductDrawer'

interface Product {
  id: string
  name_sv: string
  description_sv: string
  optimized_sv?: string
  translated_da?: string
  translated_no?: string
  status: string
}

interface Batch {
  id: string
  filename: string
  upload_date: string
  total_products: number
  status: string
  products: Product[]
}

export default function FardigaBatcharPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerField, setDrawerField] = useState<'description_sv' | 'optimized_sv' | 'translated_no' | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Load completed batches on mount
  useEffect(() => {
    const loadBatches = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/batches')
        if (response.ok) {
          const allBatches = await response.json()
          // Filter for batches with optimized products (not just completed status)
          const readyBatches = allBatches.filter((batch: Batch) => 
            batch.status === 'completed' || 
            (batch.products && batch.products.some((product: any) => product.status === 'optimized'))
          )
          setBatches(readyBatches)
        } else {
          setError('Fel vid hämtning av batchar')
        }
      } catch (err) {
        setError('Nätverksfel vid hämtning av batchar')
      } finally {
        setLoading(false)
      }
    }
    
    loadBatches()
  }, [])

  const handleBatchSelect = async (batchId: string) => {
    if (!batchId) {
      setSelectedBatch(null)
      return
    }

    try {
      const response = await fetch(`/api/batches/${batchId}`)
      if (response.ok) {
        const batchData = await response.json()
        setSelectedBatch(batchData)
      } else {
        setError('Fel vid hämtning av batch-detaljer')
      }
    } catch (err) {
      setError('Nätverksfel vid hämtning av batch-detaljer')
    }
  }

  const handleCellClick = (product: Product, field: 'description_sv' | 'optimized_sv' | 'translated_no') => {
    setDrawerProduct(product)
    setDrawerField(field)
    setIsDrawerOpen(true)
  }

  const handleSave = async (productId: string, updates: { description_sv?: string; description_no?: string; optimized_sv?: string }) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to save product')
      }

      // Update the product in the current batch
      if (selectedBatch) {
        const updatedProducts = selectedBatch.products.map(p => {
          if (p.id === productId) {
            const updatedProduct = { ...p }
            if (updates.description_sv !== undefined) {
              updatedProduct.description_sv = updates.description_sv
            }
            if (updates.description_no !== undefined) {
              updatedProduct.translated_no = updates.description_no
            }
            if (updates.optimized_sv !== undefined) {
              updatedProduct.optimized_sv = updates.optimized_sv
            }
            return updatedProduct
          }
          return p
        })
        setSelectedBatch({ ...selectedBatch, products: updatedProducts })
      }
    } catch (error) {
      console.error('Save failed:', error)
      throw error
    }
  }

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
    setDrawerProduct(null)
    setDrawerField(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Färdiga batchar
        </h1>
        
        {/* Batch selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Välj batch</h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-600">Laddar batchar...</p>
            ) : batches.length === 0 ? (
              <p className="text-gray-600">Inga batchar med optimerade produkter hittades.</p>
            ) : (
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => handleBatchSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Välj en batch --</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.filename} ({batch.total_products} produkter) - {new Date(batch.upload_date).toLocaleDateString('sv-SE')}
                  </option>
                ))}
              </select>
            )}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>

        {/* Products table */}
        {selectedBatch && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              Produkter i batch: {selectedBatch.filename}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                      ArticleId
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                      Description_sv
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                      Optimized_Description_sv
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                      Optimized_Description_no
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBatch.products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                        Inga produkter hittades i denna batch.
                      </td>
                    </tr>
                  ) : (
                    selectedBatch.products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 text-sm font-mono">
                          {product.id}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">
                          <div 
                            className="truncate-cell" 
                            title={product.description_sv}
                            onClick={() => handleCellClick(product, 'description_sv')}
                          >
                            {product.description_sv}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">
                          <div 
                            className="truncate-cell" 
                            title={product.optimized_sv || ''}
                            onClick={() => handleCellClick(product, 'optimized_sv')}
                          >
                            {product.optimized_sv || '-'}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">
                          <div 
                            className="truncate-cell" 
                            title={product.translated_no || ''}
                            onClick={() => handleCellClick(product, 'translated_no')}
                          >
                            {product.translated_no || '-'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedBatch.products.length > 0 && (
              <p className="text-sm text-gray-500 mt-4">
                Visar {selectedBatch.products.length} produkter
              </p>
            )}
          </div>
        )}

        {/* Product Drawer */}
        <ProductDrawer
          product={drawerProduct}
          field={drawerField}
          isOpen={isDrawerOpen}
          onClose={handleDrawerClose}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
