'use client'

import { useState, useEffect } from 'react'

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
}

interface ProductDrawerProps {
  product: Product | null
  field: 'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | 'translated_en' | 'translated_de' | 'translated_fr' | 'translated_es' | 'translated_it' | 'translated_pt' | 'translated_nl' | 'translated_pl' | 'translated_ru' | 'translated_fi' | null
  isOpen: boolean
  onClose: () => void
  onSave: (productId: string, updates: { description_sv?: string; description_no?: string; description_da?: string; description_en?: string; description_de?: string; description_fr?: string; description_es?: string; description_it?: string; description_pt?: string; description_nl?: string; description_pl?: string; description_ru?: string; description_fi?: string; optimized_sv?: string }) => Promise<void>
}

export default function ProductDrawer({ product, field, isOpen, onClose, onSave }: ProductDrawerProps) {
  const [descriptionSv, setDescriptionSv] = useState('')
  const [descriptionNo, setDescriptionNo] = useState('')
  const [descriptionDa, setDescriptionDa] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [descriptionDe, setDescriptionDe] = useState('')
  const [descriptionFr, setDescriptionFr] = useState('')
  const [descriptionEs, setDescriptionEs] = useState('')
  const [descriptionIt, setDescriptionIt] = useState('')
  const [descriptionPt, setDescriptionPt] = useState('')
  const [descriptionNl, setDescriptionNl] = useState('')
  const [descriptionPl, setDescriptionPl] = useState('')
  const [descriptionRu, setDescriptionRu] = useState('')
  const [descriptionFi, setDescriptionFi] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Update form when product or field changes
  useEffect(() => {
    if (product && field) {
      if (field === 'description_sv') {
        setDescriptionSv(product.description_sv || '')
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'optimized_sv') {
        setDescriptionSv(product.optimized_sv || '')
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_no') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo(product.translated_no || '')
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_da') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa(product.translated_da || '')
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_en') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn(product.translated_en || '')
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_de') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe(product.translated_de || '')
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_fr') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr(product.translated_fr || '')
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_es') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs(product.translated_es || '')
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_it') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt(product.translated_it || '')
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_pt') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt(product.translated_pt || '')
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_nl') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl(product.translated_nl || '')
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_pl') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl(product.translated_pl || '')
        setDescriptionRu('') // Not editing this field
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_ru') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu(product.translated_ru || '')
        setDescriptionFi('') // Not editing this field
      } else if (field === 'translated_fi') {
        setDescriptionSv('') // Not editing this field
        setDescriptionNo('') // Not editing this field
        setDescriptionDa('') // Not editing this field
        setDescriptionEn('') // Not editing this field
        setDescriptionDe('') // Not editing this field
        setDescriptionFr('') // Not editing this field
        setDescriptionEs('') // Not editing this field
        setDescriptionIt('') // Not editing this field
        setDescriptionPt('') // Not editing this field
        setDescriptionNl('') // Not editing this field
        setDescriptionPl('') // Not editing this field
        setDescriptionRu('') // Not editing this field
        setDescriptionFi(product.translated_fi || '')
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
      } else if (field === 'translated_en') {
        hasChanges = descriptionEn !== (product.translated_en || '')
      } else if (field === 'translated_de') {
        hasChanges = descriptionDe !== (product.translated_de || '')
      } else if (field === 'translated_fr') {
        hasChanges = descriptionFr !== (product.translated_fr || '')
      } else if (field === 'translated_es') {
        hasChanges = descriptionEs !== (product.translated_es || '')
      } else if (field === 'translated_it') {
        hasChanges = descriptionIt !== (product.translated_it || '')
      } else if (field === 'translated_pt') {
        hasChanges = descriptionPt !== (product.translated_pt || '')
      } else if (field === 'translated_nl') {
        hasChanges = descriptionNl !== (product.translated_nl || '')
      } else if (field === 'translated_pl') {
        hasChanges = descriptionPl !== (product.translated_pl || '')
      } else if (field === 'translated_ru') {
        hasChanges = descriptionRu !== (product.translated_ru || '')
      } else if (field === 'translated_fi') {
        hasChanges = descriptionFi !== (product.translated_fi || '')
      }
      setHasChanges(hasChanges)
    }
  }, [descriptionSv, descriptionNo, descriptionDa, descriptionEn, descriptionDe, descriptionFr, descriptionEs, descriptionIt, descriptionPt, descriptionNl, descriptionPl, descriptionRu, descriptionFi, product, field])

  const handleSave = async () => {
    if (!product || !hasChanges || !field) return

    setIsSaving(true)
    try {
      const updates: { description_sv?: string; description_no?: string; description_da?: string; description_en?: string; description_de?: string; description_fr?: string; description_es?: string; description_it?: string; description_pt?: string; description_nl?: string; description_pl?: string; description_ru?: string; description_fi?: string; optimized_sv?: string } = {}
      
      if (field === 'description_sv') {
        updates.description_sv = descriptionSv
      } else if (field === 'optimized_sv') {
        updates.optimized_sv = descriptionSv
      } else if (field === 'translated_no') {
        updates.description_no = descriptionNo
      } else if (field === 'translated_da') {
        updates.description_da = descriptionDa
      } else if (field === 'translated_en') {
        updates.description_en = descriptionEn
      } else if (field === 'translated_de') {
        updates.description_de = descriptionDe
      } else if (field === 'translated_fr') {
        updates.description_fr = descriptionFr
      } else if (field === 'translated_es') {
        updates.description_es = descriptionEs
      } else if (field === 'translated_it') {
        updates.description_it = descriptionIt
      } else if (field === 'translated_pt') {
        updates.description_pt = descriptionPt
      } else if (field === 'translated_nl') {
        updates.description_nl = descriptionNl
      } else if (field === 'translated_pl') {
        updates.description_pl = descriptionPl
      } else if (field === 'translated_ru') {
        updates.description_ru = descriptionRu
      } else if (field === 'translated_fi') {
        updates.description_fi = descriptionFi
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

          {field === 'translated_en' && (
            <div className="drawer-field">
              <label>Optimized_Description_en (redigerbar)</label>
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange engelsk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionEn && descriptionEn.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionEn }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_de' && (
            <div className="drawer-field">
              <label>Optimized_Description_de (redigerbar)</label>
              <textarea
                value={descriptionDe}
                onChange={(e) => setDescriptionDe(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange tysk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionDe && descriptionDe.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionDe }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_fr' && (
            <div className="drawer-field">
              <label>Optimized_Description_fr (redigerbar)</label>
              <textarea
                value={descriptionFr}
                onChange={(e) => setDescriptionFr(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange fransk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionFr && descriptionFr.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionFr }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_es' && (
            <div className="drawer-field">
              <label>Optimized_Description_es (redigerbar)</label>
              <textarea
                value={descriptionEs}
                onChange={(e) => setDescriptionEs(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange spansk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionEs && descriptionEs.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionEs }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_it' && (
            <div className="drawer-field">
              <label>Optimized_Description_it (redigerbar)</label>
              <textarea
                value={descriptionIt}
                onChange={(e) => setDescriptionIt(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange italiensk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionIt && descriptionIt.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionIt }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_pt' && (
            <div className="drawer-field">
              <label>Optimized_Description_pt (redigerbar)</label>
              <textarea
                value={descriptionPt}
                onChange={(e) => setDescriptionPt(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange portugisisk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionPt && descriptionPt.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionPt }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_nl' && (
            <div className="drawer-field">
              <label>Optimized_Description_nl (redigerbar)</label>
              <textarea
                value={descriptionNl}
                onChange={(e) => setDescriptionNl(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange holländsk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionNl && descriptionNl.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionNl }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_pl' && (
            <div className="drawer-field">
              <label>Optimized_Description_pl (redigerbar)</label>
              <textarea
                value={descriptionPl}
                onChange={(e) => setDescriptionPl(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange polsk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionPl && descriptionPl.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionPl }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_ru' && (
            <div className="drawer-field">
              <label>Optimized_Description_ru (redigerbar)</label>
              <textarea
                value={descriptionRu}
                onChange={(e) => setDescriptionRu(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange rysk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionRu && descriptionRu.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionRu }}
                  />
                </div>
              )}
            </div>
          )}

          {field === 'translated_fi' && (
            <div className="drawer-field">
              <label>Optimized_Description_fi (redigerbar)</label>
              <textarea
                value={descriptionFi}
                onChange={(e) => setDescriptionFi(e.target.value)}
                rows={20}
                style={{ minHeight: '400px' }}
                placeholder="Ange finsk beskrivning..."
                autoFocus
              />

              {/* HTML Preview */}
              {descriptionFi && descriptionFi.includes('<') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förhandsvisning (HTML)
                  </label>
                  <div 
                    className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: descriptionFi }}
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
