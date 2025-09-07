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
  translated_en?: string
  translated_de?: string
  translated_fr?: string
  translated_es?: string
  translated_it?: string
  translated_pt?: string
  translated_nl?: string
  translated_pl?: string
  translated_ru?: string
  translated_fi?: string
  translations?: string
  status: string
  batch?: {
    id: string
    filename: string
    created_at: string
  }
}

interface UIItem {
  id: string
  name: string
  values: string
  status: string
  batch?: {
    id: string
    filename: string
    created_at: string
  }
}

interface Upload {
  id: string
  filename: string
  upload_date: string
  total_products: number
  job_type: 'product_texts' | 'ui_strings'
  created_at: string
}

interface UploadSummary {
  totalRows: number
  optimizedCount: number
  translationCounts: Record<string, number>
  translationLanguages: string[]
}

export default function FardigaBatcharPage() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null)
  const [uploadItems, setUploadItems] = useState<Product[] | UIItem[]>([])
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerField, setDrawerField] = useState<'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | 'translated_en' | 'translated_de' | 'translated_fr' | 'translated_es' | 'translated_it' | 'translated_pt' | 'translated_nl' | 'translated_pl' | 'translated_ru' | 'translated_fi' | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedJobType, setSelectedJobType] = useState<'product_texts' | 'ui_strings'>('product_texts')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'batch' | 'upload', id: string, name: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Load uploads on mount and when job type changes
  useEffect(() => {
    const loadUploads = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/uploads?jobType=${selectedJobType}`)
        if (response.ok) {
          const allUploads = await response.json()
          // Filter uploads that have processed items (batches with products/ui_items)
          const uploadsWithProcessedItems = allUploads.filter((upload: any) => 
            upload.batches_count > 0
          )
          setUploads(uploadsWithProcessedItems)
        } else {
          setError('Fel vid hämtning av uploads')
        }
      } catch (err) {
        setError('Nätverksfel vid hämtning av uploads')
      } finally {
        setLoading(false)
      }
    }
    
    loadUploads()
  }, [selectedJobType])

  const handleUploadSelect = async (uploadId: string) => {
    if (!uploadId) {
      setSelectedUpload(null)
      setUploadItems([])
      setUploadSummary(null)
      return
    }

    try {
      setLoading(true)
      
      // Load upload items and summary in parallel
      const [itemsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/uploads/${uploadId}/items?jobType=${selectedJobType}`),
        fetch(`/api/uploads/${uploadId}/summary?jobType=${selectedJobType}`)
      ])

      if (itemsResponse.ok && summaryResponse.ok) {
        const itemsData = await itemsResponse.json()
        const summaryData = await summaryResponse.json()
        
        setUploadItems(itemsData.items)
        setUploadSummary(summaryData)
        
        // Find and set the selected upload
        const upload = uploads.find(u => u.id === uploadId)
        if (upload) {
          setSelectedUpload(upload)
        }
      } else {
        setError('Fel vid hämtning av upload-detaljer')
      }
    } catch (err) {
      setError('Nätverksfel vid hämtning av upload-detaljer')
    } finally {
      setLoading(false)
    }
  }

  const handleCellClick = (product: Product, field: 'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | 'translated_en' | 'translated_de' | 'translated_fr' | 'translated_es' | 'translated_it' | 'translated_pt' | 'translated_nl' | 'translated_pl' | 'translated_ru' | 'translated_fi') => {
    setDrawerProduct(product)
    setDrawerField(field)
    setIsDrawerOpen(true)
  }

  const handleSave = async (productId: string, updates: { description_sv?: string; description_no?: string; description_da?: string; description_en?: string; description_de?: string; description_fr?: string; description_es?: string; description_it?: string; description_pt?: string; description_nl?: string; description_pl?: string; description_ru?: string; description_fi?: string; optimized_sv?: string }) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to save product')
      }

      // Update the product in the current upload items
      if (selectedUpload && selectedJobType === 'product_texts') {
        const updatedItems = uploadItems.map((item: any) => {
          if (item.id === productId) {
            const updatedProduct = { ...item }
            if (updates.description_sv !== undefined) {
              updatedProduct.description_sv = updates.description_sv
            }
            if (updates.description_no !== undefined) {
              updatedProduct.translated_no = updates.description_no
            }
            if (updates.description_da !== undefined) {
              updatedProduct.translated_da = updates.description_da
            }
            if (updates.description_en !== undefined) {
              updatedProduct.translated_en = updates.description_en
            }
            if (updates.description_de !== undefined) {
              updatedProduct.translated_de = updates.description_de
            }
            if (updates.description_fr !== undefined) {
              updatedProduct.translated_fr = updates.description_fr
            }
            if (updates.description_es !== undefined) {
              updatedProduct.translated_es = updates.description_es
            }
            if (updates.description_it !== undefined) {
              updatedProduct.translated_it = updates.description_it
            }
            if (updates.description_pt !== undefined) {
              updatedProduct.translated_pt = updates.description_pt
            }
            if (updates.description_nl !== undefined) {
              updatedProduct.translated_nl = updates.description_nl
            }
            if (updates.description_pl !== undefined) {
              updatedProduct.translated_pl = updates.description_pl
            }
            if (updates.description_ru !== undefined) {
              updatedProduct.translated_ru = updates.description_ru
            }
            if (updates.description_fi !== undefined) {
              updatedProduct.translated_fi = updates.description_fi
            }
            if (updates.optimized_sv !== undefined) {
              updatedProduct.optimized_sv = updates.optimized_sv
            }
            return updatedProduct
          }
          return item
        })
        setUploadItems(updatedItems)
        
        // Reload summary to update counts
        if (selectedUpload) {
          const summaryResponse = await fetch(`/api/uploads/${selectedUpload.id}/summary?jobType=${selectedJobType}`)
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json()
            setUploadSummary(summaryData)
          }
        }
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

  const handleDeleteUpload = async () => {
    if (!deleteTarget) return

    try {
      const response = await fetch(`/api/uploads/${deleteTarget.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove the deleted upload from the list
        setUploads(prev => prev.filter(upload => upload.id !== deleteTarget.id))
        // Clear selection if the deleted upload was selected
        if (selectedUpload?.id === deleteTarget.id) {
          setSelectedUpload(null)
          setUploadItems([])
          setUploadSummary(null)
        }
        setShowDeleteModal(false)
        setDeleteTarget(null)
      } else {
        const errorData = await response.json()
        setError(`Fel vid radering av upload: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setError('Nätverksfel vid radering av upload')
    }
  }

  const handleJobTypeChange = (newJobType: 'product_texts' | 'ui_strings') => {
    setSelectedJobType(newJobType)
    setSelectedUpload(null) // Clear selection when changing job type
    setUploadItems([])
    setUploadSummary(null)
  }

  const handleExport = async () => {
    if (!selectedUpload) return

    try {
      setIsExporting(true)
      const response = await fetch(`/api/uploads/${selectedUpload.id}/export?jobType=${selectedJobType}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedUpload.filename}_upload_export.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        setError('Fel vid export av upload')
      }
    } catch (err) {
      setError('Nätverksfel vid export av upload')
    } finally {
      setIsExporting(false)
    }
  }

  const openDeleteModal = (type: 'upload', id: string, name: string) => {
    setDeleteTarget({ type, id, name })
    setShowDeleteModal(true)
  }

  return (
    <div style={{ flex: 1, padding: '2rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', margin: '0 0 0.5rem 0' }}>Färdiga uploads</h1>
          <p style={{ fontSize: '1.125rem', color: '#6b7280', margin: '0' }}>Hantera och granska dina färdiga uploads med aggregerade resultat</p>
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
        
          {/* Upload selector */}
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
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>Välj upload</h2>
                  <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Välj en upload att granska och hantera</p>
                </div>
                {selectedUpload && (
                  <button
                    onClick={() => openDeleteModal('upload', selectedUpload.id, selectedUpload.filename)}
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
                    title="Radera upload"
                  >
                    🗑️ Radera upload
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Laddar uploads...</p>
                ) : uploads.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Inga uploads för vald typ hittades.</p>
                ) : (
                  <select
                    value={selectedUpload?.id || ''}
                    onChange={(e) => handleUploadSelect(e.target.value)}
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
                    <option value="">-- Välj en upload --</option>
                    {uploads.map((upload) => (
                      <option key={upload.id} value={upload.id}>
                        {upload.filename} ({upload.total_products} rader) - {new Date(upload.upload_date).toLocaleDateString('sv-SE')}
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

          {/* Summary section */}
          {selectedUpload && uploadSummary && (
            <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6' }}>3</div>
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>Summering</h2>
                      <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Översikt över bearbetade rader och översättningar</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    style={{
                      background: isExporting ? '#9ca3af' : '#10b981',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: isExporting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease'
                    }}
                    title="Exportera Excel (upload)"
                  >
                    {isExporting ? '⏳' : '📊'} {isExporting ? 'Exporterar...' : 'Exportera Excel (upload)'}
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Totalt</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{uploadSummary.totalRows}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Optimerade (SV)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{uploadSummary.optimizedCount}/{uploadSummary.totalRows}</div>
                  </div>
                  {uploadSummary.translationLanguages.map(lang => (
                    <div key={lang} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Översatta ({lang.toUpperCase()})</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{uploadSummary.translationCounts[lang] || 0}/{uploadSummary.totalRows}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Products/UI items table */}
          {selectedUpload && (
            <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6' }}>4</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
                      {selectedJobType === 'product_texts' ? 'Produkter' : 'UI-element'} i upload: {selectedUpload.filename}
                    </h2>
                    <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Granska och redigera innehållet i uploaden (aggregerat från alla batchar)</p>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {selectedJobType === 'product_texts' ? (
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
                            Optimized_Text_sv
                          </th>
                          {uploadSummary?.translationLanguages.map(lang => (
                            <th key={lang} style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                              description_{lang}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {uploadItems.length === 0 ? (
                          <tr>
                            <td colSpan={3 + (uploadSummary?.translationLanguages.length || 0)} style={{ border: '1px solid #d1d5db', padding: '2rem 1rem', textAlign: 'center', color: '#6b7280' }}>
                              Inga produkter hittades i denna upload.
                            </td>
                          </tr>
                        ) : (
                          (uploadItems as Product[]).map((product) => {
                            // Parse translations from the new translations field
                            let translations: Record<string, string> = {}
                            if (product.translations) {
                              try {
                                translations = JSON.parse(product.translations)
                              } catch (error) {
                                console.warn('Failed to parse translations for product:', product.id)
                              }
                            }

                            return (
                              <tr key={product.id} style={{ transition: 'background-color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                                <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                                  {product.id}
                                </td>
                                <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                  <div 
                                    style={{ 
                                      cursor: 'pointer',
                                      transition: 'background-color 0.2s ease'
                                    }}
                                    title={product.description_sv}
                                    onClick={() => handleCellClick(product, 'description_sv')}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    {product.description_sv.length > 40 
                                      ? `${product.description_sv.substring(0, 40)}...` 
                                      : product.description_sv}
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                  <div 
                                    style={{ 
                                      cursor: 'pointer',
                                      transition: 'background-color 0.2s ease'
                                    }}
                                    title={product.optimized_sv || ''}
                                    onClick={() => handleCellClick(product, 'optimized_sv')}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    {product.optimized_sv ? (
                                      product.optimized_sv.length > 40 
                                        ? `${product.optimized_sv.substring(0, 40)}...` 
                                        : product.optimized_sv
                                    ) : (
                                      <span style={{ color: '#9ca3af' }}>-</span>
                                    )}
                                  </div>
                                </td>
                                {uploadSummary?.translationLanguages.map(lang => {
                                  // Get translation value from new translations field or fallback to legacy fields
                                  let translationValue = translations[lang] || ''
                                  if (!translationValue) {
                                    if (lang === 'da' && product.translated_da) {
                                      translationValue = product.translated_da
                                    } else if (lang === 'no' && product.translated_no) {
                                      translationValue = product.translated_no
                                    } else if (lang === 'en' && product.translated_en) {
                                      translationValue = product.translated_en
                                    } else if (lang === 'de' && product.translated_de) {
                                      translationValue = product.translated_de
                                    } else if (lang === 'fr' && product.translated_fr) {
                                      translationValue = product.translated_fr
                                    } else if (lang === 'es' && product.translated_es) {
                                      translationValue = product.translated_es
                                    } else if (lang === 'it' && product.translated_it) {
                                      translationValue = product.translated_it
                                    } else if (lang === 'pt' && product.translated_pt) {
                                      translationValue = product.translated_pt
                                    } else if (lang === 'nl' && product.translated_nl) {
                                      translationValue = product.translated_nl
                                    } else if (lang === 'pl' && product.translated_pl) {
                                      translationValue = product.translated_pl
                                    } else if (lang === 'ru' && product.translated_ru) {
                                      translationValue = product.translated_ru
                                    } else if (lang === 'fi' && product.translated_fi) {
                                      translationValue = product.translated_fi
                                    }
                                  }

                                  const fieldName = `translated_${lang}` as 'translated_da' | 'translated_no' | 'translated_en' | 'translated_de' | 'translated_fr' | 'translated_es' | 'translated_it' | 'translated_pt' | 'translated_nl' | 'translated_pl' | 'translated_ru' | 'translated_fi'

                                  return (
                                    <td key={lang} style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                      <div 
                                        style={{ 
                                          cursor: 'pointer',
                                          transition: 'background-color 0.2s ease'
                                        }}
                                        title={translationValue}
                                        onClick={() => handleCellClick(product, fieldName)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        {translationValue ? (
                                          translationValue.length > 40 
                                            ? `${translationValue.substring(0, 40)}...` 
                                            : translationValue
                                        ) : (
                                          <span style={{ color: '#9ca3af' }}>-</span>
                                        )}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })
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
                          {uploadSummary?.translationLanguages.map(lang => (
                            <th key={lang} style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                              {lang}
                            </th>
                          ))}
                          <th style={{ border: '1px solid #d1d5db', padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadItems.length === 0 ? (
                          <tr>
                            <td colSpan={1 + (uploadSummary?.translationLanguages.length || 0) + 1} style={{ border: '1px solid #d1d5db', padding: '2rem 1rem', textAlign: 'center', color: '#6b7280' }}>
                              Inga UI-element hittades i denna upload.
                            </td>
                          </tr>
                        ) : (
                          (uploadItems as UIItem[]).map((item) => {
                            const values = item.values ? JSON.parse(item.values) : {}
                            return (
                              <tr key={item.id} style={{ transition: 'background-color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                                <td style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500' }}>
                                  <div title={item.name}>
                                    {item.name.length > 40 
                                      ? `${item.name.substring(0, 40)}...` 
                                      : item.name}
                                  </div>
                                </td>
                                {uploadSummary?.translationLanguages.map(lang => (
                                  <td key={lang} style={{ border: '1px solid #d1d5db', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                    <div title={String(values[lang] || '')}>
                                      {values[lang] ? (
                                        String(values[lang]).length > 40 
                                          ? `${String(values[lang]).substring(0, 40)}...` 
                                          : String(values[lang])
                                      ) : (
                                        <span style={{ color: '#9ca3af' }}>(tom)</span>
                                      )}
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
                {uploadItems.length > 0 && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1rem', textAlign: 'center' }}>
                    Visar {uploadItems.length} {selectedJobType === 'product_texts' ? 'produkter' : 'UI-element'} (aggregerat från alla batchar)
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
                  Är du säker på att du vill radera uploaden "{deleteTarget.name}"?
                  Detta kan inte ångras.
                </p>
                
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={handleDeleteUpload}
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
