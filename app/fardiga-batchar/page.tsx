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
  job_type: 'product_texts' | 'ui_strings'
  products: Product[]
  ui_items?: any[]
}

export default function FardigaBatcharPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerField, setDrawerField] = useState<'description_sv' | 'optimized_sv' | 'translated_no' | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedJobType, setSelectedJobType] = useState<'product_texts' | 'ui_strings'>('product_texts')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'batch' | 'upload', id: string, name: string } | null>(null)

  // Load completed batches on mount and when job type changes
  useEffect(() => {
    const loadBatches = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/batches?jobType=${selectedJobType}`)
        if (response.ok) {
          const allBatches = await response.json()
          // Filter for batches with optimized products or completed status
          const readyBatches = allBatches.filter((batch: Batch) => 
            batch.status === 'completed' || 
            (batch.products && batch.products.some((product: any) => product.status === 'optimized')) ||
            (batch.ui_items && batch.ui_items.length > 0) // UI items are ready when they exist
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
  }, [selectedJobType])

  const handleBatchSelect = async (batchId: string) => {
    if (!batchId) {
      setSelectedBatch(null)
      return
    }

    try {
      const response = await fetch(`/api/batches/${batchId}`)
      if (response.ok) {
        const batchData = await response.json()
        // Ensure the batch data has the expected structure
        const normalizedBatch = {
          ...batchData,
          products: batchData.products || [],
          ui_items: batchData.ui_items || []
        }
        setSelectedBatch(normalizedBatch)
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

  const handleDeleteBatch = async () => {
    if (!deleteTarget) return

    try {
      const response = await fetch(`/api/batches/${deleteTarget.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove the deleted batch from the list
        setBatches(prev => prev.filter(batch => batch.id !== deleteTarget.id))
        // Clear selection if the deleted batch was selected
        if (selectedBatch?.id === deleteTarget.id) {
          setSelectedBatch(null)
        }
        setShowDeleteModal(false)
        setDeleteTarget(null)
      } else {
        const errorData = await response.json()
        setError(`Fel vid radering av batch: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setError('Nätverksfel vid radering av batch')
    }
  }

  const handleJobTypeChange = (newJobType: 'product_texts' | 'ui_strings') => {
    setSelectedJobType(newJobType)
    setSelectedBatch(null) // Clear selection when changing job type
  }

  const openDeleteModal = (type: 'batch' | 'upload', id: string, name: string) => {
    setDeleteTarget({ type, id, name })
    setShowDeleteModal(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Färdiga batchar
        </h1>
        
        {/* Job type selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Välj jobbtyp</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="jobType"
                  value="product_texts"
                  checked={selectedJobType === 'product_texts'}
                  onChange={() => handleJobTypeChange('product_texts')}
                  className="mr-2"
                />
                Produkttexter
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="jobType"
                  value="ui_strings"
                  checked={selectedJobType === 'ui_strings'}
                  onChange={() => handleJobTypeChange('ui_strings')}
                  className="mr-2"
                />
                UI-element (Webbplatstexter)
              </label>
            </div>
          </div>
        </div>
        
        {/* Batch selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Välj batch</h2>
            {selectedBatch && (
              <button
                onClick={() => openDeleteModal('batch', selectedBatch.id, selectedBatch.filename)}
                className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm"
                title="Radera batch"
              >
                🗑️ Radera batch
              </button>
            )}
          </div>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-600">Laddar batchar...</p>
            ) : batches.length === 0 ? (
              <p className="text-gray-600">Inga batchar för vald typ hittades.</p>
            ) : (
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => handleBatchSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Välj en batch --</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.filename} ({batch.total_products} {selectedJobType === 'product_texts' ? 'produkter' : 'UI-element'}) - {new Date(batch.upload_date).toLocaleDateString('sv-SE')}
                  </option>
                ))}
              </select>
            )}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>

        {/* Products/UI items table */}
        {selectedBatch && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {selectedJobType === 'product_texts' ? 'Produkter' : 'UI-element'} i batch: {selectedBatch.filename}
            </h2>
            <div className="overflow-x-auto">
              {selectedJobType === 'product_texts' ? (
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
              ) : (
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                        Namn
                      </th>
                      {selectedBatch.ui_items && selectedBatch.ui_items.length > 0 && selectedBatch.ui_items[0].values && Object.keys(JSON.parse(selectedBatch.ui_items[0].values)).map(locale => (
                        <th key={locale} className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                          {locale}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedBatch.ui_items || selectedBatch.ui_items.length === 0 ? (
                      <tr>
                        <td colSpan={selectedBatch.ui_items && selectedBatch.ui_items.length > 0 && selectedBatch.ui_items[0].values ? Object.keys(JSON.parse(selectedBatch.ui_items[0].values)).length + 1 : 1} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                          Inga UI-element hittades i denna batch.
                        </td>
                      </tr>
                    ) : (
                      selectedBatch.ui_items.map((item) => {
                        const values = item.values ? JSON.parse(item.values) : {}
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2 text-sm font-medium">
                              {item.name}
                            </td>
                            {Object.entries(values).map(([locale, value]) => (
                              <td key={locale} className="border border-gray-300 px-4 py-2 text-sm">
                                <div className="truncate-cell" title={String(value || '')}>
                                  {String(value || '(tom)')}
                                </div>
                              </td>
                            ))}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {((selectedJobType === 'product_texts' && selectedBatch.products.length > 0) || 
              (selectedJobType === 'ui_strings' && selectedBatch.ui_items && selectedBatch.ui_items.length > 0)) && (
              <p className="text-sm text-gray-500 mt-4">
                Visar {selectedJobType === 'product_texts' ? selectedBatch.products.length : selectedBatch.ui_items?.length || 0} {selectedJobType === 'product_texts' ? 'produkter' : 'UI-element'}
              </p>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">
                Bekräfta radering
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Är du säker på att du vill radera {deleteTarget.type === 'batch' ? 'batchen' : 'uploaden'} "{deleteTarget.name}"?
                {deleteTarget.type === 'batch' && ' Detta kan inte ångras.'}
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteBatch}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Radera
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteTarget(null)
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Avbryt
                </button>
              </div>
            </div>
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
