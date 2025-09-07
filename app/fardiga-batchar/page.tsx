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
  created_at: string
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
          // Filter for batches with optimized products or completed status, sorted by created_at DESC
          const readyBatches = allBatches
            .filter((batch: Batch) => 
              batch.job_type === selectedJobType && (
                batch.status === 'completed' || 
                (batch.products && batch.products.some((product: any) => product.status === 'optimized')) ||
                (batch.ui_items && batch.ui_items.length > 0) // UI items are ready when they exist
              )
            )
            .sort((a: Batch, b: Batch) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
    <div style={{ flex: 1, padding: '2rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', margin: '0 0 0.5rem 0' }}>Färdiga batchar</h1>
          <p style={{ fontSize: '1.125rem', color: '#6b7280', margin: '0' }}>Hantera och granska dina färdiga översättningsbatchar</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Job type selector */}
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6' }}>1</div>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>Filtrera efter jobbtyp</h2>
                  <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Välj typ av batchar att visa</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => handleJobTypeChange('product_texts')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '2px solid',
                    background: selectedJobType === 'product_texts' ? '#3b82f6' : 'white',
                    borderColor: selectedJobType === 'product_texts' ? '#3b82f6' : '#e5e7eb',
                    color: selectedJobType === 'product_texts' ? 'white' : '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>📦</span>
                  <span>Produkttexter</span>
                </button>
                <button
                  onClick={() => handleJobTypeChange('ui_strings')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '2px solid',
                    background: selectedJobType === 'ui_strings' ? '#3b82f6' : 'white',
                    borderColor: selectedJobType === 'ui_strings' ? '#3b82f6' : '#e5e7eb',
                    color: selectedJobType === 'ui_strings' ? 'white' : '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>🌐</span>
                  <span>UI-element</span>
                </button>
              </div>
            </div>
          </div>
        
          {/* Batch selector */}
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6' }}>2</div>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>Välj batch</h2>
                  <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Välj en batch att granska och hantera</p>
                </div>
                {selectedBatch && (
                  <button
                    onClick={() => openDeleteModal('batch', selectedBatch.id, selectedBatch.filename)}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease'
                    }}
                    title="Radera batch"
                  >
                    🗑️ Radera batch
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Laddar batchar...</p>
                ) : batches.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Inga batchar för vald typ hittades.</p>
                ) : (
                  <select
                    value={selectedBatch?.id || ''}
                    onChange={(e) => handleBatchSelect(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem', 
                      outline: 'none', 
                      fontSize: '0.875rem', 
                      backgroundColor: 'white',
                      minHeight: '2.75rem',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="">-- Välj en batch --</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.filename} ({batch.total_products} {batch.job_type === 'product_texts' ? 'produkter' : 'UI-element'}) - {new Date(batch.upload_date).toLocaleDateString('sv-SE')}
                      </option>
                    ))}
                  </select>
                )}
                {error && (
                  <p style={{ fontSize: '0.875rem', color: '#dc2626', textAlign: 'center' }}>{error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Products/UI items table */}
          {selectedBatch && (
            <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6' }}>3</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
                      {selectedBatch.job_type === 'product_texts' ? 'Produkter' : 'UI-element'} i batch: {selectedBatch.filename}
                    </h2>
                    <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Granska och redigera innehållet i batchen</p>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {selectedBatch.job_type === 'product_texts' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            ArticleId
                          </th>
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            Description_sv
                          </th>
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            Optimized_Description_sv
                          </th>
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            Optimized_Description_no
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBatch.products.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ border: '1px solid #d1d5db', padding: '2rem 1rem', textAlign: 'center', color: '#6b7280' }}>
                              Inga produkter hittades i denna batch.
                            </td>
                          </tr>
                        ) : (
                          selectedBatch.products.map((product) => (
                            <tr key={product.id} style={{ transition: 'background-color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                              <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                                {product.id}
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                <div 
                                  style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease'
                                  }}
                                  title={product.description_sv}
                                  onClick={() => handleCellClick(product, 'description_sv')}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  {product.description_sv}
                                </div>
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                <div 
                                  style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease'
                                  }}
                                  title={product.optimized_sv || ''}
                                  onClick={() => handleCellClick(product, 'optimized_sv')}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  {product.optimized_sv || '-'}
                                </div>
                              </td>
                              <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                <div 
                                  style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease'
                                  }}
                                  title={product.translated_no || ''}
                                  onClick={() => handleCellClick(product, 'translated_no')}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            Namn
                          </th>
                          {selectedBatch.ui_items && selectedBatch.ui_items.length > 0 && selectedBatch.ui_items[0].values && Object.keys(JSON.parse(selectedBatch.ui_items[0].values)).map(locale => (
                            <th key={locale} style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                              {locale}
                            </th>
                          ))}
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {!selectedBatch.ui_items || selectedBatch.ui_items.length === 0 ? (
                          <tr>
                            <td colSpan={selectedBatch.ui_items && selectedBatch.ui_items.length > 0 && selectedBatch.ui_items[0].values ? Object.keys(JSON.parse(selectedBatch.ui_items[0].values)).length + 2 : 2} style={{ border: '1px solid #d1d5db', padding: '2rem 1rem', textAlign: 'center', color: '#6b7280' }}>
                              Inga UI-element hittades i denna batch.
                            </td>
                          </tr>
                        ) : (
                          selectedBatch.ui_items.map((item) => {
                            const values = item.values ? JSON.parse(item.values) : {}
                            return (
                              <tr key={item.id} style={{ transition: 'background-color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                                <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500' }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                                    {item.name}
                                  </div>
                                </td>
                                {Object.entries(values).map(([locale, value]) => (
                                  <td key={locale} style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(value || '')}>
                                      {String(value || '(tom)')}
                                    </div>
                                  </td>
                                ))}
                                <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                                  {item.status || 'pending'}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
                {((selectedBatch.job_type === 'product_texts' && selectedBatch.products.length > 0) || 
                  (selectedBatch.job_type === 'ui_strings' && selectedBatch.ui_items && selectedBatch.ui_items.length > 0)) && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1rem', textAlign: 'center' }}>
                    Visar {selectedBatch.job_type === 'product_texts' ? selectedBatch.products.length : selectedBatch.ui_items?.length || 0} {selectedBatch.job_type === 'product_texts' ? 'produkter' : 'UI-element'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && deleteTarget && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '28rem', width: '100%', margin: '0 1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
                  Bekräfta radering
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  Är du säker på att du vill radera {deleteTarget.type === 'batch' ? 'batchen' : 'uploaden'} "{deleteTarget.name}"?
                  {deleteTarget.type === 'batch' && ' Detta kan inte ångras.'}
                </p>
                
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={handleDeleteBatch}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Radera
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteTarget(null)
                    }}
                    style={{
                      background: '#6b7280',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
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
    </div>
  )
}
