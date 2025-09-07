'use client'

import { useState, useEffect } from 'react'

interface Product {
  id: string
  name_sv: string
  description_sv: string
  optimized_sv?: string
  translated_da?: string
  translated_no?: string
}

interface ProductDrawerProps {
  product: Product | null
  field: 'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | null
  isOpen: boolean
  onClose: () => void
  onSave: (productId: string, updates: { description_sv?: string; description_no?: string; description_da?: string; optimized_sv?: string }) => Promise<void>
}

export default function ProductDrawer({ product, field, isOpen, onClose, onSave }: ProductDrawerProps) {
  const [descriptionSv, setDescriptionSv] = useState('')
  const [descriptionNo, setDescriptionNo] = useState('')
  const [descriptionDa, setDescriptionDa] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Update form when product or field changes
  useEffect(() => {
    if (product && field) {
      if (field === 'description_sv') {
        setDescriptionSv(product.description_sv || '')
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
      } else if (field === 'optimized_sv') {
        setDescriptionSv(product.optimized_sv || '')
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
      } else if (field === 'translated_no') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo(product.translated_no || '')
        setDescriptionDa('') // Not editing this field
      } else if (field === 'translated_da') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa(product.translated_da || '')
      }
      setHasChanges(false)
    }
  }, [product, field])

  // Check for changes
  useEffect(() => {
    if (product && field) {
      let hasChanges = false
      if (field === 'description_sv') {
        hasChanges = descriptionSv !== (product.description_sv || '')
      } else if (field === 'optimized_sv') {
        hasChanges = descriptionSv !== (product.optimized_sv || '')
      } else if (field === 'translated_no') {
        hasChanges = descriptionNo !== (product.translated_no || '')
      } else if (field === 'translated_da') {
        hasChanges = descriptionDa !== (product.translated_da || '')
      }
      setHasChanges(hasChanges)
    }
  }, [descriptionSv, descriptionNo, descriptionDa, product, field])

  const handleSave = async () => {
    if (!product || !hasChanges || !field) return

    setIsSaving(true)
    try {
      const updates: { description_sv?: string; description_no?: string; description_da?: string; optimized_sv?: string } = {}
      
      if (field === 'description_sv') {
        updates.description_sv = descriptionSv
      } else if (field === 'optimized_sv') {
        updates.optimized_sv = descriptionSv
      } else if (field === 'translated_no') {
        updates.description_no = descriptionNo
      } else if (field === 'translated_da') {
        updates.description_da = descriptionDa
      }
      
      await onSave(product.id, updates)
      onClose()
    } catch (error) {
      console.error('Save failed:', error)
      // TODO: Show error message to user
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen || !product) return null

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="drawer-header">
          <h2 className="text-xl font-semibold text-gray-900">
            Redigera produkt
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Stäng"
          >
            ×
          </button>
        </div>

        <div className="drawer-content">
          <div className="mb-4">
            <h3 className="font-medium text-gray-900">{product.name_sv}</h3>
            <p className="text-sm text-gray-500">ID: {product.id}</p>
          </div>

          {/* Show only the clicked field */}
          {field === 'description_sv' && (
            <div className="drawer-field readonly">
              <label>Description_sv (read-only)</label>
              <textarea
                value={product.description_sv || ''}
                readOnly
                rows={20}
                style={{ minHeight: '400px' }}
              />
            </div>
          )}

          {field === 'optimized_sv' && (
            <div className="drawer-field">
              <label>Optimized_Description_sv (redigerbar)</label>
              <textarea
                value={descriptionSv}
                onChange={(e) => setDescriptionSv(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange optimerad svensk beskrivning..."
                autoFocus
              />
              
              {/* HTML Preview */}
              {descriptionSv && descriptionSv.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionSv }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_no' && (
            <div className="drawer-field">
              <label>Optimized_Description_no (redigerbar)</label>
              <textarea
                value={descriptionNo}
                onChange={(e) => setDescriptionNo(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange norsk beskrivning..."
                autoFocus
              />
              
              {/* HTML Preview */}
              {descriptionNo && descriptionNo.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionNo }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_da' && (
            <div className="drawer-field">
              <label>Optimized_Description_da (redigerbar)</label>
              <textarea
                value={descriptionDa}
                onChange={(e) => setDescriptionDa(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange dansk beskrivning..."
                autoFocus
              />
              
              {/* HTML Preview */}
              {descriptionDa && descriptionDa.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionDa }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}
