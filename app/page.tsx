'use client'

import { useState, useEffect, useRef } from 'react'

interface Progress {
  percent: number
  done?: number
  total?: number
  counts?: {
    pending: number
    optimizing: number
    optimized: number
    translating: number
    completed: number
    error: number
  }
}

interface Product {
  name_sv: string;
  description_sv: string;
  attributes?: string;
  tone_hint?: string;
  optimized_sv?: string;
  status?: string;
}

interface PromptSettings {
  optimize: {
    system: string;
    headers: string;
    maxWords: number;
    temperature: number;
    model: string;
    toneDefault: string;
  };
  translate: {
    system: string;
    temperature: number;
    model: string;
  };
}

type Phase = 'idle' | 'uploaded' | 'batched' | 'optimizing' | 'translating' | 'readyToExport'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [productsCount, setProductsCount] = useState<number>(0)
  const [parsedProducts, setParsedProducts] = useState<Product[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchId, setBatchId] = useState<string>('')
  const [visibleRows, setVisibleRows] = useState<number>(200)
  const [progress, setProgress] = useState<Progress>({
    percent: 0,
    counts: { pending: 0, optimizing: 0, optimized: 0, translating: 0, completed: 0, error: 0 }
  })
  const [phase, setPhase] = useState<Phase>('idle')
  const [languages, setLanguages] = useState<Set<'da' | 'no'>>(new Set(['da' as const, 'no' as const]))
  const [error, setError] = useState<string>('')
  const [uploadAlert, setUploadAlert] = useState<string>('')
  const [batchAlert, setBatchAlert] = useState<string>('')
  const [optimizeAlert, setOptimizeAlert] = useState<string>('')
  const [translateAlert, setTranslateAlert] = useState<string>('')
  const [exportAlert, setExportAlert] = useState<string>('')
  const [openaiMode, setOpenaiMode] = useState<string>('stub')
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [optimizationStartTime, setOptimizationStartTime] = useState<number | null>(null)
  
  // Prompt settings state
  const [promptSettings, setPromptSettings] = useState<PromptSettings>({
    optimize: {
      system: 'roll + regler enligt SYSTEM.md, inga nya fakta, rubriklista',
      headers: '# Kort beskrivning\n## Fördelar\n## Specifikationer (punktlista med nyckel: värde)\n## Användning\n## Leverans & innehåll',
      maxWords: 120,
      temperature: 0.2,
      model: 'gpt-4o-mini',
      toneDefault: ''
    },
    translate: {
      system: 'professionell översättare, bevara rubriker/punktlistor, ingen extra fakta',
      temperature: 0,
      model: 'gpt-4o-mini'
    }
  })
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load prompt settings and openaiMode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('promptSettingsV1')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPromptSettings(parsed)
      } catch (err) {
        console.warn('Failed to parse saved prompt settings, using defaults')
      }
    }
    
    const mode = localStorage.getItem('openaiMode') ?? 'stub'
    setOpenaiMode(mode)
  }, [])

  // Debounced save to localStorage
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('promptSettingsV1', JSON.stringify(promptSettings))
    }, 300)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [promptSettings])

  // Update progress based on selected products during optimization
  useEffect(() => {
    if (phase === 'optimizing') {
      const interval = setInterval(() => {
        fetchUpdatedProducts()
      }, 1000) // Check every second
      
      return () => clearInterval(interval)
    }
  }, [phase, batchId])

  // Update timer display during optimization
  useEffect(() => {
    if (optimizationStartTime && phase === 'optimizing') {
      const interval = setInterval(() => {
        // Force re-render to update timer
        setProgress(prev => ({ ...prev }))
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [optimizationStartTime, phase])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validera filstorlek (≤16MB)
    if (selectedFile.size > 16 * 1024 * 1024) {
      setError('Filen är för stor. Maximal storlek är 16MB.')
      return
    }

    setFile(selectedFile)
    setError('')
    setUploadAlert('')
    setParsedProducts([])
    setSelectedIds(new Set())
  }

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setProductsCount(data.products.length)
        setParsedProducts(data.products)
        setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
        setBatchId(data.batchId) // Set batchId from upload response
        setPhase('uploaded')
        setUploadAlert(`✅ Fil uppladdad! ${data.products.length} produkter hittades.`)
      } else {
        const errorData = await response.json()
        setUploadAlert(`❌ Fel vid uppladdning: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setUploadAlert('❌ Fel vid uppladdning: Nätverksfel')
    }
  }

  const handleCreateBatch = async () => {
    if (!file || selectedIds.size === 0) return

    // No need to create a new batch - just set the phase
    // The batch was already created during upload
    setPhase('batched')
    setBatchAlert(`✅ Batch redo! ${selectedIds.size} produkter valda för optimering.`)
  }

  const handleOptimize = async () => {
    if (!batchId) return

    // 1. Show progress UI immediately
    setPhase('optimizing')
    setOptimizeAlert('✅ Optimering startad! Följer framsteg...')
    setOptimizationStartTime(Date.now())
    
    // 2. Start SSE connection before POST
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    
    const eventSource = new EventSource(`/api/batches/${batchId}/events?selectedIndices=${Array.from(selectedIds).join(',')}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setProgress(data.data)
        } else if (data.type === 'end') {
          eventSource.close()
          eventSourceRef.current = null
          setPhase('readyToExport')
          setOptimizeAlert('✅ Optimering klar!')
          setOptimizationStartTime(null)
        }
      } catch (err) {
        console.error('Fel vid parsing av SSE-data:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
      setOptimizeAlert('❌ Fel vid SSE-anslutning')
    }

    // 3. Fire-and-forget the POST request
    try {
      const response = await fetch(`/api/batches/${batchId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedIndices: Array.from(selectedIds),
          clientPromptSettings: {
            optimize: {
              system: promptSettings.optimize.system,
              headers: promptSettings.optimize.headers,
              maxWords: promptSettings.optimize.maxWords,
              temperature: promptSettings.optimize.temperature,
              model: promptSettings.optimize.model,
              toneDefault: promptSettings.optimize.toneDefault
            },
            translate: {
              system: promptSettings.translate.system,
              temperature: promptSettings.translate.temperature,
              model: promptSettings.translate.model
            }
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        setOptimizeAlert(`❌ Fel vid start av optimering: ${errorData.error || 'Okänt fel'}`)
        eventSource.close()
        eventSourceRef.current = null
        setPhase('batched') // Reset phase on error
      }
    } catch (err) {
      setOptimizeAlert('❌ Fel vid start av optimering: Nätverksfel')
      eventSource.close()
      eventSourceRef.current = null
      setPhase('batched') // Reset phase on error
    }
  }

  const handleTranslate = async () => {
    if (!batchId || languages.size === 0) return

    try {
      const response = await fetch(`/api/batches/${batchId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languages: Array.from(languages),
          clientPromptSettings: {
            optimize: {
              system: promptSettings.optimize.system,
              headers: promptSettings.optimize.headers,
              maxWords: promptSettings.optimize.maxWords,
              temperature: promptSettings.optimize.temperature,
              model: promptSettings.optimize.model,
              toneDefault: promptSettings.optimize.toneDefault
            },
            translate: {
              system: promptSettings.translate.system,
              temperature: promptSettings.translate.temperature,
              model: promptSettings.translate.model
            }
          }
        })
      })

      if (response.ok) {
        setPhase('translating')
        setTranslateAlert('✅ Översättning startad!')
      } else {
        const errorData = await response.json()
        setTranslateAlert(`❌ Fel vid start av översättning: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setTranslateAlert('❌ Fel vid start av översättning: Nätverksfel')
    }
  }

  const handleExport = () => {
    if (!batchId) return
    
    window.location.href = `/api/batches/${batchId}/export`
    setExportAlert('✅ Export startad! Filen laddas ner.')
  }

  const handleLanguageChange = (lang: 'da' | 'no') => {
    const newLanguages = new Set(languages)
    if (newLanguages.has(lang)) {
      newLanguages.delete(lang)
    } else {
      newLanguages.add(lang)
    }
    setLanguages(newLanguages)
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(parsedProducts.map((_, index) => index)))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleSelectFirst = (count: number) => {
    const indices = Array.from({ length: Math.min(count, parsedProducts.length) }, (_, i) => i)
    setSelectedIds(new Set(indices))
  }

  const handleSelectRandom = (count: number) => {
    const indices = Array.from({ length: parsedProducts.length }, (_, i) => i)
    const shuffled = indices.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(count, parsedProducts.length))
    setSelectedIds(new Set(selected))
  }

  const handleProductToggle = (index: number) => {
    const newSelectedIds = new Set(selectedIds)
    if (newSelectedIds.has(index)) {
      newSelectedIds.delete(index)
    } else {
      newSelectedIds.add(index)
    }
    setSelectedIds(newSelectedIds)
  }

  const handleShowMore = () => {
    setVisibleRows(prev => prev + 200)
  }

  const toggleProductExpansion = (index: number) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedProducts(newExpanded)
  }

  const formatOptimizedText = (text: string) => {
    // Replace line breaks with <br> tags for HTML display
    return text.replace(/\n/g, '<br>')
  }

  const getElapsedTime = () => {
    if (!optimizationStartTime) return ''
    const elapsed = Math.floor((Date.now() - optimizationStartTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Function to fetch updated products from backend
  const fetchUpdatedProducts = async () => {
    if (!batchId) return
    
    try {
      const response = await fetch(`/api/batches/${batchId}`)
      if (response.ok) {
        const batchData = await response.json()
        if (batchData.products) {
          setParsedProducts(prev => 
            prev.map((product, index) => ({
              ...product,
              status: batchData.products[index]?.status || product.status,
              optimized_sv: batchData.products[index]?.optimized_sv || product.optimized_sv
            }))
          )
        }
      }
    } catch (err) {
      console.error('Fel vid hämtning av uppdaterade produkter:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Lekia Produktöversättning
        </h1>

        {/* A) Upload-sektion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">A) Ladda upp Excel-fil</h2>
          <div className="space-y-4">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="text-sm text-gray-600">
                Vald fil: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              onClick={handleUpload}
              disabled={!file}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Ladda upp
            </button>
            {uploadAlert && (
              <p className={`text-sm ${uploadAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {uploadAlert}
              </p>
            )}
          </div>
        </div>

        {/* B) Produkturval-sektion */}
        {phase === 'uploaded' && parsedProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">B) Välj produkter ({selectedIds.size} av {parsedProducts.length})</h2>
            <div className="space-y-4">
              {/* Urvalsknappar */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSelectAll}
                  className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
                >
                  Välj alla
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 text-sm"
                >
                  Avmarkera alla
                </button>
                <button
                  onClick={() => handleSelectFirst(100)}
                  className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                >
                  Första 100
                </button>
                <button
                  onClick={() => handleSelectFirst(500)}
                  className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                >
                  Första 500
                </button>
                <button
                  onClick={() => handleSelectFirst(1000)}
                  className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                >
                  Första 1000
                </button>
                <button
                  onClick={() => handleSelectRandom(100)}
                  className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 text-sm"
                >
                  Slump 100
                </button>
              </div>

              {/* Produktlista */}
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === parsedProducts.length && parsedProducts.length > 0}
                          onChange={selectedIds.size === parsedProducts.length ? handleDeselectAll : handleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produktnamn</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beskrivning</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedProducts.slice(0, visibleRows).map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(index)}
                            onChange={() => handleProductToggle(index)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                          {product.name_sv}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {product.description_sv.length > 120 
                            ? `${product.description_sv.substring(0, 120)}...` 
                            : product.description_sv}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Visa fler-knapp */}
              {visibleRows < parsedProducts.length && (
                <div className="text-center">
                  <button
                    onClick={handleShowMore}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                  >
                    Visa fler ({Math.min(200, parsedProducts.length - visibleRows)} till)
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    Visar {Math.min(visibleRows, parsedProducts.length)} av {parsedProducts.length} produkter
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* C) Skapa batch-sektion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">C) Skapa batch</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCreateBatch}
                disabled={phase !== 'uploaded' || selectedIds.size === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Skapa batch
              </button>
              {selectedIds.size === 0 && (
                <span className="text-sm text-red-600">⚠️ Välj minst en produkt för att skapa batch</span>
              )}
            </div>
            {batchAlert && (
              <p className={`text-sm ${batchAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {batchAlert}
              </p>
            )}
          </div>
        </div>

        {/* Prompt-inställningar panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Prompt-inställningar</h2>
                <div className="flex items-center gap-2">
                                     <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                     {openaiMode === 'stub' ? 'Stubb' : 'Live'}
                   </span>
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {/* Compact preview when collapsed */}
              <div className="mt-2 text-sm text-gray-500 space-y-1">
                <p>SV-optimering: {promptSettings.optimize.system.substring(0, 80)}...</p>
                <p>Översättning: {promptSettings.translate.system.substring(0, 80)}...</p>
                <p>Modell: {promptSettings.optimize.model} | Temp: {promptSettings.optimize.temperature}</p>
              </div>
            </summary>
            
            <div className="mt-6 space-y-6">
              {/* SV-optimering inställningar */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">SV-optimering</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Systemprompt
                  </label>
                  <textarea
                    value={promptSettings.optimize.system}
                    onChange={(e) => setPromptSettings(prev => ({
                      ...prev,
                      optimize: { ...prev.optimize, system: e.target.value }
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="roll + regler enligt SYSTEM.md, inga nya fakta, rubriklista"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rubriklista (1 rad/rubrik)
                  </label>
                  <textarea
                    value={promptSettings.optimize.headers}
                    onChange={(e) => setPromptSettings(prev => ({
                      ...prev,
                      optimize: { ...prev.optimize, headers: e.target.value }
                    }))}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="# Kort beskrivning&#10;## Fördelar&#10;## Specifikationer (punktlista med nyckel: värde)&#10;## Användning&#10;## Leverans & innehåll"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max ord per sektion
                    </label>
                    <input
                      type="number"
                      value={promptSettings.optimize.maxWords}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        optimize: { ...prev.optimize, maxWords: parseInt(e.target.value) || 120 }
                      }))}
                      min="50"
                      max="500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Temperatur
                    </label>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.1"
                      value={promptSettings.optimize.temperature}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        optimize: { ...prev.optimize, temperature: parseFloat(e.target.value) }
                      }))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {promptSettings.optimize.temperature}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modell
                    </label>
                    <select
                      value={promptSettings.optimize.model}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        optimize: { ...prev.optimize, model: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Standard-ton (används om produkter saknar tone_hint)
                    </label>
                    <input
                      type="text"
                      value={promptSettings.optimize.toneDefault}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        optimize: { ...prev.optimize, toneDefault: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="t.ex. professionell, vänlig, teknisk"
                    />
                  </div>
                </div>
              </div>
              
              {/* Översättning inställningar */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Översättning</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Systemprompt
                  </label>
                  <textarea
                    value={promptSettings.translate.system}
                    onChange={(e) => setPromptSettings(prev => ({
                      ...prev,
                      translate: { ...prev.translate, system: e.target.value }
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="professionell översättare, bevara rubriker/punktlistor, ingen extra fakta"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Temperatur
                    </label>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.1"
                      value={promptSettings.translate.temperature}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        translate: { ...prev.translate, temperature: parseFloat(e.target.value) }
                      }))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {promptSettings.translate.temperature}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modell
                    </label>
                    <select
                      value={promptSettings.translate.model}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        translate: { ...prev.translate, model: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* D) Optimera-sektion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">D) Optimera (Svenska)</h2>
          <div className="space-y-4">
            <button
              onClick={handleOptimize}
              disabled={!batchId || phase === 'optimizing'}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Optimera (SV)
            </button>
            
            {/* Debug info */}
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
              <p><strong>Debug info:</strong></p>
              <p>Phase: {phase}</p>
              <p>Batch ID: {batchId || 'Ingen'}</p>
              <p>Selected IDs: {selectedIds.size} av {parsedProducts.length}</p>
              <p>Selected indices: {Array.from(selectedIds).slice(0, 10).join(', ')}{selectedIds.size > 10 ? '...' : ''}</p>
            </div>
            
            {phase === 'optimizing' && (
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>
                    {progress.percent}% klart ({progress.done || 0}/{progress.total || 0} produkter)
                  </span>
                  {optimizationStartTime && (
                    <span className="font-mono">
                      Tid: {getElapsedTime()}
                    </span>
                  )}
                </div>
                {progress.counts && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>Väntar: {progress.counts.pending}</div>
                    <div>Optimerar: {progress.counts.optimizing}</div>
                    <div>Klar: {progress.counts.optimized}</div>
                  </div>
                )}
              </div>
            )}
            
            {optimizeAlert && (
              <p className={`text-sm ${optimizeAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {optimizeAlert}
              </p>
            )}
            
            {/* Visa optimerade produkter */}
            {phase === 'readyToExport' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Optimerade produkter (klicka för att expandera):</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Array.from(selectedIds).map((index) => {
                    const product = parsedProducts[index];
                    if (!product) return null;
                    const isExpanded = expandedProducts.has(index);
                    return (
                      <div 
                        key={index} 
                        className="text-xs bg-white p-3 rounded border cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleProductExpansion(index)}
                        title="Klicka för att expandera/kollapsa"
                      >
                        <div className="font-medium flex items-center justify-between">
                          <span>{product.name_sv}</span>
                          <span className="text-gray-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                        {isExpanded && product.optimized_sv ? (
                          <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                            <div dangerouslySetInnerHTML={{ 
                              __html: formatOptimizedText(product.optimized_sv) 
                            }} />
                          </div>
                        ) : (
                          <div className="text-gray-500 truncate">
                            {product.optimized_sv ? 'Klicka för att se optimerad text...' : 'Inte optimerad än'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-500">
              Prompt-inställningar används lokalt (nästa steg kopplar in servern).
            </p>
          </div>
        </div>

        {/* E) Översätt-sektion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">E) Översätt</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={languages.has('da')}
                  onChange={() => handleLanguageChange('da')}
                  className="mr-2"
                />
                Danska (da)
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={languages.has('no')}
                  onChange={() => handleLanguageChange('no')}
                  className="mr-2"
                />
                Norska (no)
              </label>
            </div>
            <button
              onClick={handleTranslate}
              disabled={!batchId || phase !== 'readyToExport' || languages.size === 0}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Översätt
            </button>
            {translateAlert && (
              <p className={`text-sm ${translateAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {translateAlert}
              </p>
            )}
            
            <p className="text-xs text-gray-500">
              Prompt-inställningar används lokalt (nästa steg kopplar in servern).
            </p>
          </div>
        </div>

        {/* F) Export-sektion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">F) Exportera Excel</h2>
          <div className="space-y-4">
            <button
              onClick={handleExport}
              disabled={!batchId}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Exportera Excel
            </button>
            {exportAlert && (
              <p className={`text-sm ${exportAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {exportAlert}
              </p>
            )}
          </div>
        </div>

        {/* TODO för framtida e2e-tester */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-8">
          <p className="text-sm text-yellow-800">
            <strong>TODO:</strong> add e2e/UI tests in next step
          </p>
        </div>
      </div>
    </div>
  )
}
