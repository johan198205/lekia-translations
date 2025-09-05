'use client'

import { useState, useEffect, useRef } from 'react'
import ProductDrawer from '../components/ProductDrawer'

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
  id: string;
  name_sv: string;
  description_sv: string;
  attributes?: string;
  tone_hint?: string;
  optimized_sv?: string;
  translated_da?: string;
  translated_no?: string;
  status?: string;
  batch_id?: string;
}

interface UIString {
  id: string;
  name: string;
  values: Record<string, string>;
  status?: string;
}

interface Upload {
  id: string;
  filename: string;
  upload_date: string;
  total_products: number;
  products_remaining: number;
  batches_count: number;
  job_type: 'product_texts' | 'ui_strings';
  created_at: string;
  updated_at: string;
}

interface Batch {
  id: string;
  filename: string;
  upload_date: string;
  total_products: number;
  status: string;
  created_at: string;
  upload_id: string;
  job_type: 'product_texts' | 'ui_strings';
  products: Product[];
  ui_items?: any[];
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
  const [jobType, setJobType] = useState<'product_texts' | 'ui_strings'>('product_texts')
  const [productsCount, setProductsCount] = useState<number>(0)
  const [parsedProducts, setParsedProducts] = useState<Product[]>([])
  const [parsedUIStrings, setParsedUIStrings] = useState<UIString[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchId, setBatchId] = useState<string>('')
  const [visibleRows, setVisibleRows] = useState<number>(200)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null)
  const [uploadId, setUploadId] = useState<string>('')
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [availableBatches, setAvailableBatches] = useState<Batch[]>([])
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Filter uploads based on selected jobType
  const filteredUploads = uploads.filter(upload => upload.job_type === jobType)
  const [regenerateScope, setRegenerateScope] = useState<'all' | 'selected'>('all')
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
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
  const [translationStartTime, setTranslationStartTime] = useState<number | null>(null)
  const [translationLanguage, setTranslationLanguage] = useState<'no' | 'da' | null>(null)
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerField, setDrawerField] = useState<'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
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

  // Load existing uploads and batches on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load uploads
        const uploadsResponse = await fetch('/api/uploads')
        if (uploadsResponse.ok) {
          const uploadsData = await uploadsResponse.json()
          setUploads(uploadsData)
        }

        // Load batches
        const batchesResponse = await fetch('/api/batches')
        if (batchesResponse.ok) {
          const batchesData = await batchesResponse.json()
          setBatches(batchesData)
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    
    loadData()
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

  // Update progress based on selected products during optimization and translation
  useEffect(() => {
    if ((phase === 'optimizing' || phase === 'translating') && batchId && jobType) {
      const interval = setInterval(() => {
        fetchUpdatedProducts()
      }, 1000) // Check every second
      
      return () => clearInterval(interval)
    }
  }, [phase, batchId, jobType])

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

  // Update timer display during translation
  useEffect(() => {
    if (translationStartTime && phase === 'translating') {
      const interval = setInterval(() => {
        // Force re-render to update timer
        setProgress(prev => ({ ...prev }))
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [translationStartTime, phase])

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
    setParsedUIStrings([])
    setSelectedIds(new Set())
    setSelectedUpload(null)
    setUploadId('')
  }

  const handleJobTypeChange = (newJobType: 'product_texts' | 'ui_strings') => {
    setJobType(newJobType)
    setFile(null)
    setError('')
    setUploadAlert('')
    setParsedProducts([])
    setParsedUIStrings([])
    setSelectedIds(new Set())
    setSelectedUpload(null)
    setUploadId('')
  }

  const handleUploadSelect = async (upload: Upload) => {
    setSelectedUpload(upload)
    setSelectedBatch(null) // Clear batch selection
    setUploadId(upload.id)
    setFile(null)
    setError('')
    setUploadAlert('')
    
    // Filter batches for this upload
    const uploadBatches = batches.filter(batch => batch.upload_id === upload.id)
    setAvailableBatches(uploadBatches)
    
    // If no batches exist for this upload, load items directly
    if (uploadBatches.length === 0) {
      try {
        const endpoint = upload.job_type === 'product_texts' 
          ? `/api/uploads/${upload.id}/products`
          : `/api/uploads/${upload.id}/ui-items`
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          if (upload.job_type === 'product_texts') {
            setParsedProducts(data.products)
            setProductsCount(data.products.length)
            setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
            setUploadAlert(`✅ Upload vald: ${upload.filename} (${data.products.length} produkter)`)
          } else {
            setParsedUIStrings(data.uiItems)
            setProductsCount(data.uiItems.length)
            setSelectedIds(new Set(data.uiItems.map((_: any, index: number) => index)))
            setUploadAlert(`✅ Upload vald: ${upload.filename} (${data.uiItems.length} UI-element)`)
          }
          setPhase('uploaded')
        } else {
          setUploadAlert('❌ Fel vid hämtning av upload-data')
        }
      } catch (err) {
        setUploadAlert('❌ Fel vid hämtning av upload-data: Nätverksfel')
      }
    } else {
      setUploadAlert(`✅ Upload vald: ${upload.filename}. Välj batch nedan.`)
    }
  }

  const handleBatchSelect = async (batch: Batch) => {
    setSelectedBatch(batch)
    setSelectedUpload(null) // Clear upload selection
    setFile(null)
    setError('')
    setUploadAlert('')
    
    try {
      const response = await fetch(`/api/batches/${batch.id}`)
      if (response.ok) {
        const data = await response.json()
        if (batch.job_type === 'product_texts') {
          setParsedProducts(data.products)
          setProductsCount(data.products.length)
          setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
          setUploadAlert(`✅ Batch vald: ${batch.filename} (${data.products.length} produkter)`)
        } else {
          // Handle UI items
          const uiItems = data.ui_items.map((item: any) => ({
            id: item.id,
            name: item.name,
            values: JSON.parse(item.values),
            status: item.status
          }))
          setParsedUIStrings(uiItems)
          setProductsCount(uiItems.length)
          setSelectedIds(new Set(uiItems.map((_: any, index: number) => index)))
          setUploadAlert(`✅ Batch vald: ${batch.filename} (${uiItems.length} UI-element)`)
        }
        setBatchId(batch.id)
        setPhase('readyToExport') // Skip to ready state since batch already exists
      } else {
        setUploadAlert('❌ Fel vid hämtning av batch-data')
      }
    } catch (err) {
      setUploadAlert('❌ Fel vid hämtning av batch-data: Nätverksfel')
    }
  }

  const handleUpload = async () => {
    if (!file || isUploading) return

    setIsUploading(true)
    setError('')
    setUploadAlert('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('jobType', jobType)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        
        if (jobType === 'product_texts' && data.products) {
          setProductsCount(data.products.length)
          setParsedProducts(data.products)
          setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
          setUploadId(data.uploadId)
          setPhase('uploaded')
          setUploadAlert(`✅ Fil uppladdad! ${data.products.length} produkter hittades.`)
        } else if (jobType === 'ui_strings' && data.uiStrings) {
          setProductsCount(data.uiStrings.length)
          setParsedUIStrings(data.uiStrings)
          setSelectedIds(new Set(data.uiStrings.map((_: any, index: number) => index)))
          setUploadId(data.uploadId)
          setPhase('uploaded')
          const locales = data.meta?.locales || []
          setUploadAlert(`✅ Fil uppladdad! ${data.uiStrings.length} UI-element hittades. Språk: ${locales.join(', ')}`)
        }
        
        // Reload uploads list to include the new upload
        const uploadsResponse = await fetch('/api/uploads')
        if (uploadsResponse.ok) {
          const uploadsData = await uploadsResponse.json()
          setUploads(uploadsData)
        }
      } else {
        const errorData = await response.json()
        setUploadAlert(`❌ Fel vid uppladdning: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setUploadAlert('❌ Fel vid uppladdning: Nätverksfel')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCreateBatch = async () => {
    if (!uploadId || selectedIds.size === 0) return

    try {
      let selectedItemIds: string[] = []
      
      if (jobType === 'product_texts') {
        // Get selected product IDs
        selectedItemIds = Array.from(selectedIds).map(index => parsedProducts[index]?.id).filter(Boolean)
      } else {
        // Get selected UI item IDs
        selectedItemIds = Array.from(selectedIds).map(index => parsedUIStrings[index]?.id).filter(Boolean)
      }
      
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadId,
          job_type: jobType,
          selected_ids: selectedItemIds
        })
      })

      if (response.ok) {
        const data = await response.json()
        setBatchId(data.id)
        
        // For UI elements, immediately set phase to readyToExport since no optimization is needed
        if (jobType === 'ui_strings') {
          setPhase('readyToExport')
        } else {
          setPhase('batched')
        }
        
        setBatchAlert(`✅ Batch skapad! ${selectedIds.size} ${jobType === 'product_texts' ? 'produkter' : 'UI-element'} valda.`)
        
        // Load the batch data to show the items immediately
        try {
          const batchResponse = await fetch(`/api/batches/${data.id}`)
          if (batchResponse.ok) {
            const batchData = await batchResponse.json()
            if (jobType === 'product_texts' && batchData.products) {
              setParsedProducts(batchData.products)
            } else if (jobType === 'ui_strings' && batchData.ui_items) {
              const uiItems = batchData.ui_items.map((item: any) => ({
                id: item.id,
                name: item.name,
                values: JSON.parse(item.values),
                status: item.status
              }))
              setParsedUIStrings(uiItems)
            }
          }
        } catch (err) {
          console.error('Error loading batch data:', err)
        }
      } else {
        const errorData = await response.json()
        setBatchAlert(`❌ Fel vid skapande av batch: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setBatchAlert('❌ Fel vid skapande av batch: Nätverksfel')
    }
  }

  const handleCreateBatchFromRemaining = async () => {
    if (!selectedUpload) return

    try {
      // Load remaining items for manual selection
      const endpoint = selectedUpload.job_type === 'product_texts' 
        ? `/api/uploads/${selectedUpload.id}/products`
        : `/api/uploads/${selectedUpload.id}/ui-items`
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        if (selectedUpload.job_type === 'product_texts') {
          setParsedProducts(data.products)
          setProductsCount(data.products.length)
          setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
          setUploadAlert(`✅ ${data.products.length} återstående produkter laddade. Välj produkter nedan och klicka "Skapa batch".`)
        } else {
          setParsedUIStrings(data.uiItems)
          setProductsCount(data.uiItems.length)
          setSelectedIds(new Set(data.uiItems.map((_: any, index: number) => index)))
          setUploadAlert(`✅ ${data.uiItems.length} återstående UI-element laddade. Välj UI-element nedan och klicka "Skapa batch".`)
        }
        setPhase('uploaded')
      } else {
        setUploadAlert('❌ Fel vid hämtning av återstående data')
      }
    } catch (err) {
      setUploadAlert('❌ Fel vid hämtning av återstående data: Nätverksfel')
    }
  }

  const handleOptimize = async () => {
    if (!batchId) return

    // 1. Show progress UI immediately
    setPhase('optimizing')
    setOptimizeAlert(jobType === 'product_texts' ? '✅ Optimering startad! Följer framsteg...' : '✅ Markerar UI-element som klara...')
    setOptimizationStartTime(Date.now())
    
    // 2. Start SSE connection before POST (for both products and UI elements)
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
          if (jobType === 'product_texts') {
            setOptimizeAlert('✅ Optimering klar!')
            setOptimizationStartTime(null)
            // Fetch updated data to show the optimization results
            fetchUpdatedProducts()
          } else {
            setTranslateAlert('✅ Översättning klar!')
            setTranslationStartTime(null)
            setTranslationLanguage(null)
            // Fetch updated data to show the translation results
            fetchUpdatedProducts()
          }
        }
      } catch (err) {
        console.error('Fel vid parsing av SSE-data:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
      if (jobType === 'product_texts') {
        setOptimizeAlert('❌ Fel vid SSE-anslutning')
      } else {
        setTranslateAlert('❌ Fel vid SSE-anslutning')
      }
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
        if (jobType === 'product_texts') {
          setOptimizeAlert(`❌ Fel vid start av optimering: ${errorData.error || 'Okänt fel'}`)
        } else {
          setTranslateAlert(`❌ Fel vid start av översättning: ${errorData.error || 'Okänt fel'}`)
        }
        eventSource.close()
        eventSourceRef.current = null
        setPhase('batched') // Reset phase on error
      }
    } catch (err) {
      if (jobType === 'product_texts') {
        setOptimizeAlert('❌ Fel vid start av optimering: Nätverksfel')
      } else {
        setTranslateAlert('❌ Fel vid start av översättning: Nätverksfel')
      }
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

  const handleTranslateSpecific = async (language: 'no' | 'da') => {
    if (!batchId || selectedIds.size === 0) return

    // 1. Show progress UI immediately
    setPhase('translating')
    setTranslationLanguage(language)
    setTranslateAlert(`✅ Översättning till ${language.toUpperCase()} startad!`)
    setTranslationStartTime(Date.now())
    
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
          setTranslateAlert(`✅ Översättning till ${language.toUpperCase()} klar!`)
          setTranslationStartTime(null)
          setTranslationLanguage(null)
          
          // Fetch updated data to show the translation results
          fetchUpdatedProducts()
        }
      } catch (err) {
        console.error('Fel vid parsing av SSE-data:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
      setTranslateAlert('❌ Fel vid SSE-anslutning')
    }

    // 3. Fire-and-forget the POST request
    try {
      const selectedItemIds = jobType === 'product_texts' 
        ? Array.from(selectedIds).map(index => parsedProducts[index]?.id).filter(Boolean)
        : Array.from(selectedIds).map(index => parsedUIStrings[index]?.id).filter(Boolean)
      
      const response = await fetch(`/api/batches/${batchId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languages: [language],
          selectedProductIds: selectedItemIds,
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
        setTranslateAlert(`❌ Fel vid start av översättning: ${errorData.error || 'Okänt fel'}`)
        eventSource.close()
        eventSourceRef.current = null
        setPhase('readyToExport') // Reset phase on error
        setTranslationStartTime(null)
        setTranslationLanguage(null)
      } else {
        // For UI elements, we get a jobId response
        const responseData = await response.json()
        if (jobType === 'ui_strings' && responseData.jobId) {
          console.log(`[UI TRANSLATE] Started with jobId: ${responseData.jobId}, total: ${responseData.total}`)
        }
      }
    } catch (err) {
      setTranslateAlert('❌ Fel vid start av översättning: Nätverksfel')
      eventSource.close()
      eventSourceRef.current = null
      setPhase('readyToExport') // Reset phase on error
      setTranslationStartTime(null)
      setTranslationLanguage(null)
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

  const getCurrentItems = () => {
    return jobType === 'product_texts' ? parsedProducts : parsedUIStrings
  }

  const handleSelectAll = () => {
    const items = getCurrentItems()
    setSelectedIds(new Set(items.map((_, index) => index)))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleSelectFirst = (count: number) => {
    const items = getCurrentItems()
    const indices = Array.from({ length: Math.min(count, items.length) }, (_, i) => i)
    setSelectedIds(new Set(indices))
  }

  const handleSelectRandom = (count: number) => {
    const items = getCurrentItems()
    const indices = Array.from({ length: items.length }, (_, i) => i)
    const shuffled = indices.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(count, items.length))
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

  const getTranslationElapsedTime = () => {
    if (!translationStartTime) return ''
    const elapsed = Math.floor((Date.now() - translationStartTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getProductStatus = (product: Product) => {
    if (!product.optimized_sv || !product.optimized_sv.trim()) {
      return 'pending'
    }
    
    const hasNo = product.translated_no && product.translated_no.trim()
    const hasDa = product.translated_da && product.translated_da.trim()
    
    // Status enligt nya regler:
    // SV optimerad, NO/DK saknas → optimized
    // NO finns, DK saknas → translated (no)
    // NO & DK finns → translated (no, dk)
    if (hasNo && hasDa) {
      return 'translated (no, dk)'
    } else if (hasNo) {
      return 'translated (no)'
    } else {
      return 'optimized'
    }
  }

  const handleCellClick = (product: Product, field: 'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da') => {
    setDrawerProduct(product)
    setDrawerField(field)
    setIsDrawerOpen(true)
  }

  const handleSave = async (productId: string, updates: { description_sv?: string; description_no?: string; description_da?: string; optimized_sv?: string }) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to save product')
      }

      // Update the product in the current parsed products
      setParsedProducts(prev => 
        prev.map(p => {
          if (p.id === productId) {
            const updatedProduct = { ...p }
            if (updates.description_sv !== undefined) {
              updatedProduct.description_sv = updates.description_sv
            }
            if (updates.description_no !== undefined) {
              updatedProduct.translated_no = updates.description_no
            }
            if (updates.description_da !== undefined) {
              updatedProduct.translated_da = updates.description_da
            }
            if (updates.optimized_sv !== undefined) {
              updatedProduct.optimized_sv = updates.optimized_sv
            }
            return updatedProduct
          }
          return p
        })
      )
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

  const handleRegenerate = async () => {
    if (!batchId) return

    setIsRegenerating(true)
    setShowRegenerateModal(false)
    
    try {
      const itemIds = regenerateScope === 'selected' 
        ? Array.from(selectedIds).map(index => parsedProducts[index]?.id).filter(Boolean)
        : undefined

      const response = await fetch(`/api/batches/${batchId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds,
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
        setOptimizeAlert('✅ Regenerering startad! Följer framsteg...')
        setPhase('optimizing')
        setOptimizationStartTime(Date.now())
        
        // Start SSE connection for progress
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
              setOptimizeAlert('✅ Regenerering klar!')
              setOptimizationStartTime(null)
              setIsRegenerating(false)
              // Fetch updated data to show the regeneration results
              fetchUpdatedProducts()
            }
          } catch (err) {
            console.error('Fel vid parsing av SSE-data:', err)
          }
        }

        eventSource.onerror = () => {
          eventSource.close()
          eventSourceRef.current = null
          setOptimizeAlert('❌ Fel vid SSE-anslutning')
          setIsRegenerating(false)
        }
      } else {
        const errorData = await response.json()
        setOptimizeAlert(`❌ Fel vid start av regenerering: ${errorData.error || 'Okänt fel'}`)
        setIsRegenerating(false)
      }
    } catch (err) {
      setOptimizeAlert('❌ Fel vid start av regenerering: Nätverksfel')
      setIsRegenerating(false)
    }
  }

  // Function to fetch updated products or UI items from backend
  const fetchUpdatedProducts = async () => {
    if (!batchId || !jobType) return
    
    try {
      const response = await fetch(`/api/batches/${batchId}`)
      if (response.ok) {
        const batchData = await response.json()
        if (jobType === 'product_texts' && batchData.products && Array.isArray(batchData.products)) {
          setParsedProducts(prev => 
            prev.map((product) => {
              // Find the updated product by ID instead of index
              const updatedProduct = batchData.products.find((p: any) => p.id === product.id)
              if (updatedProduct) {
                return {
                  ...product,
                  status: updatedProduct.status || product.status,
                  optimized_sv: updatedProduct.optimized_sv || product.optimized_sv,
                  translated_no: updatedProduct.translated_no || product.translated_no,
                  translated_da: updatedProduct.translated_da || product.translated_da
                }
              }
              return product
            })
          )
        } else if (jobType === 'ui_strings' && batchData.ui_items && Array.isArray(batchData.ui_items)) {
          const updatedUIItems = batchData.ui_items.map((item: any) => ({
            id: item.id,
            name: item.name,
            values: JSON.parse(item.values),
            status: item.status
          }))
          setParsedUIStrings(updatedUIItems)
        }
      }
    } catch (err) {
      console.error('Fel vid hämtning av uppdaterade data:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Lekia Produktöversättning
        </h1>

        {/* A) Upload-sektion */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">A) Välj eller ladda upp Excel-fil</h2>
          <div className="space-y-4">
            
            {/* Jobbtyp-val */}
            <div className="space-y-2">
              <label htmlFor="jobTypeSelect" className="block text-sm font-medium text-gray-700">
                Jobbtyp:
              </label>
              <select
                id="jobTypeSelect"
                name="jobType"
                value={jobType}
                onChange={(e) => handleJobTypeChange(e.target.value as 'product_texts' | 'ui_strings')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="product_texts">Produkttexter (befintligt)</option>
                <option value="ui_strings">UI-element / Webbplatstexter (NY)</option>
              </select>
              {jobType === 'ui_strings' && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                  <p><strong>UI-element format:</strong></p>
                  <p>• Obligatorisk kolumn: <code>Name</code></p>
                  <p>• Språkkolumner: <code>en-US</code>, <code>sv-SE</code>, <code>no-NO</code> (och fler)</p>
                  <p>• Tomma fält tillåts (t.ex. no-NO tom i given fil)</p>
                </div>
              )}
            </div>
            
            {/* Befintliga uploads */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Befintliga uploads:
              </label>
              <select
                value={selectedUpload?.id || ''}
                onChange={(e) => {
                  const upload = uploads.find(u => u.id === e.target.value)
                  if (upload) {
                    handleUploadSelect(upload)
                  } else {
                    setSelectedUpload(null)
                    setSelectedBatch(null)
                    setUploadId('')
                    setParsedProducts([])
                    setSelectedIds(new Set())
                    setPhase('idle')
                    setAvailableBatches([])
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedBatch !== null}
              >
                <option value="">-- Välj befintlig upload --</option>
                {uploads
                  .filter(upload => upload.job_type === jobType)
                  .map((upload) => (
                  <option key={upload.id} value={upload.id}>
                    {upload.filename} ({upload.products_remaining} {jobType === 'product_texts' ? 'produkter' : 'UI-element'} kvar, {upload.batches_count} batches)
                  </option>
                ))}
              </select>
              {selectedUpload && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <p><strong>Fil:</strong> {selectedUpload.filename}</p>
                  <p><strong>Uppladdad:</strong> {new Date(selectedUpload.upload_date).toLocaleString('sv-SE')}</p>
                  <p><strong>Totalt produkter:</strong> {selectedUpload.total_products}</p>
                  <p><strong>Produkter kvar att optimera:</strong> {selectedUpload.products_remaining}</p>
                  <p><strong>Skapade batches:</strong> {selectedUpload.batches_count}</p>
                </div>
              )}
            </div>

            {/* Befintliga batchar för vald upload */}
            {selectedUpload && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Befintliga batchar för {selectedUpload.filename}:
                </label>
                
                {/* Knapp för att välja återstående produkter */}
                <div className="mb-3">
                  <button
                    onClick={handleCreateBatchFromRemaining}
                    disabled={selectedUpload.products_remaining === 0}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      selectedUpload.products_remaining > 0
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={selectedUpload.products_remaining === 0 ? 'Inga återstående produkter att välja' : 'Välj återstående produkter för ny batch'}
                  >
                    Välj återstående produkter för ny batch
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedUpload.products_remaining} återstår
                  </p>
                </div>
                
                {availableBatches.length > 0 && (
                  <>
                    <select
                      value={selectedBatch?.id || ''}
                      onChange={(e) => {
                        const batch = availableBatches.find(b => b.id === e.target.value)
                        if (batch) {
                          handleBatchSelect(batch)
                        } else {
                          setSelectedBatch(null)
                          setBatchId('')
                          setParsedProducts([])
                          setSelectedIds(new Set())
                          setPhase('idle')
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Välj befintlig batch --</option>
                      {availableBatches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.filename} ({batch.total_products} produkter, status: {batch.status})
                        </option>
                      ))}
                    </select>
                    {selectedBatch && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <p><strong>Batch:</strong> {selectedBatch.filename}</p>
                        <p><strong>Skapad:</strong> {new Date(selectedBatch.created_at).toLocaleString('sv-SE')}</p>
                        <p><strong>Totalt produkter:</strong> {selectedBatch.total_products}</p>
                        <p><strong>Status:</strong> {selectedBatch.status}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {uploads.length > 0 && (
              <div className="text-center text-gray-500">eller</div>
            )}

            {/* Ny fil-upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Ladda upp ny fil:
              </label>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                disabled={selectedBatch !== null}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={!file || selectedBatch !== null || isUploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Laddar upp...' : 'Ladda upp ny fil'}
              </button>
              {selectedBatch && (
                <p className="text-sm text-gray-500">
                  Filuppladdning inaktiverad när batch är vald
                </p>
              )}
              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Laddar upp fil...</span>
                </div>
              )}
            </div>

            {uploadAlert && (
              <p className={`text-sm ${uploadAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {uploadAlert}
              </p>
            )}
          </div>
        </div>

        {/* B) Produkturval-sektion */}
        {phase === 'uploaded' && ((jobType === 'product_texts' && parsedProducts.length > 0) || (jobType === 'ui_strings' && parsedUIStrings.length > 0)) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              B) Välj {jobType === 'product_texts' ? 'produkter' : 'UI-element'} ({selectedIds.size} av {jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length})
            </h2>
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
                          checked={selectedIds.size === getCurrentItems().length && getCurrentItems().length > 0}
                          onChange={selectedIds.size === getCurrentItems().length ? handleDeselectAll : handleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {jobType === 'product_texts' ? 'Produktnamn' : 'Namn'}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {jobType === 'product_texts' ? 'Beskrivning' : 'Värden'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getCurrentItems().slice(0, visibleRows).map((item, index) => (
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
                          {jobType === 'product_texts' ? (item as Product).name_sv : (item as UIString).name}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {jobType === 'product_texts' ? (
                            (item as Product).description_sv.length > 120 
                              ? `${(item as Product).description_sv.substring(0, 120)}...` 
                              : (item as Product).description_sv
                          ) : (
                            <div className="space-y-1">
                              {Object.entries((item as UIString).values).map(([locale, value]) => (
                                <div key={locale} className="text-xs">
                                  <span className="font-medium">{locale}:</span> {value || '(tom)'}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Visa fler-knapp */}
              {visibleRows < getCurrentItems().length && (
                <div className="text-center">
                  <button
                    onClick={handleShowMore}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                  >
                    Visa fler ({Math.min(200, getCurrentItems().length - visibleRows)} till)
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    Visar {Math.min(visibleRows, getCurrentItems().length)} av {getCurrentItems().length} {jobType === 'product_texts' ? 'produkter' : 'UI-element'}
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
                <span className="text-sm text-red-600">⚠️ Välj minst en {jobType === 'product_texts' ? 'produkt' : 'UI-element'} för att skapa batch</span>
              )}
            </div>
            {batchAlert && (
              <p className={`text-sm ${batchAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {batchAlert}
              </p>
            )}
          </div>
        </div>


        {/* D) Optimera & Översätt-sektion */}
        {((jobType === 'product_texts' && (phase === 'batched' || phase === 'optimizing' || phase === 'translating' || phase === 'readyToExport')) || (jobType === 'ui_strings' && (phase === 'readyToExport' || phase === 'translating'))) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {jobType === 'product_texts' ? 'D) Optimera & Översätt' : 'D) Översätt'}
            </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              {jobType === 'product_texts' ? (
                <>
                  <button
                    onClick={handleOptimize}
                    disabled={!batchId || phase === 'optimizing'}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Optimera (SV)
                  </button>
                  
                  {/* Översättningsknappar för produkttexter */}
                  {(() => {
                    const selectedProducts = Array.from(selectedIds).map(index => parsedProducts[index]).filter(Boolean)
                    const allHaveOptimizedSv = selectedProducts.length > 0 && selectedProducts.every(p => p.optimized_sv && p.optimized_sv.trim())
                    const hasSelectedProducts = selectedIds.size > 0
                    
                    return (
                      <>
                        <button
                          onClick={() => handleTranslateSpecific('no')}
                          disabled={!batchId || !allHaveOptimizedSv || !hasSelectedProducts || phase === 'translating'}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          title={!allHaveOptimizedSv ? "Kräver optimerad svensk text" : ""}
                        >
                          Översätt till norska (NO)
                        </button>
                        <button
                          onClick={() => handleTranslateSpecific('da')}
                          disabled={!batchId || !allHaveOptimizedSv || !hasSelectedProducts || phase === 'translating'}
                          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          title={!allHaveOptimizedSv ? "Kräver optimerad svensk text" : ""}
                        >
                          Översätt till danska (DK)
                        </button>
                      </>
                    )
                  })()}
                </>
              ) : (
                <>
                  {/* Översättningsknappar för UI-element */}
                  <button
                    onClick={() => handleTranslateSpecific('no')}
                    disabled={!batchId || selectedIds.size === 0 || phase === 'translating'}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Översätt till norska (no-NO)
                  </button>
                  <button
                    onClick={() => handleTranslateSpecific('da')}
                    disabled={!batchId || selectedIds.size === 0 || phase === 'translating'}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Översätt till danska (da-DK)
                  </button>
                </>
              )}
            </div>
            
            {/* Debug info - only in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                <p><strong>Debug info:</strong></p>
                <p>Phase: {phase}</p>
                <p>Batch ID: {batchId || 'Ingen'}</p>
                <p>Selected IDs: {selectedIds.size} av {jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length}</p>
                <p>Selected indices: {Array.from(selectedIds).slice(0, 10).join(', ')}{selectedIds.size > 10 ? '...' : ''}</p>
              </div>
            )}
            
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
                    {progress.percent}% klart ({progress.done || 0}/{progress.total || 0} {jobType === 'product_texts' ? 'produkter' : 'UI-element'})
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
                    <div>{jobType === 'product_texts' ? 'Optimerar' : 'Bearbetar'}: {progress.counts.optimizing}</div>
                    <div>Klar: {progress.counts.optimized}</div>
                  </div>
                )}
              </div>
            )}

            {phase === 'translating' && (
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>
                    {progress.percent}% klart ({progress.done || 0}/{progress.total || 0} {jobType === 'product_texts' ? 'produkter' : 'UI-element'})
                  </span>
                  {translationStartTime && (
                    <span className="font-mono">
                      Tid: {getTranslationElapsedTime()}
                    </span>
                  )}
                </div>
                {progress.counts && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>Väntar: {progress.counts.pending}</div>
                    <div>{jobType === 'product_texts' ? 'Översätter' : 'Bearbetar'}: {jobType === 'product_texts' ? progress.counts.translating : progress.counts.optimizing}</div>
                    <div>Klar: {progress.counts.completed}</div>
                  </div>
                )}
              </div>
            )}
            
            {optimizeAlert && (
              <p className={`text-sm ${optimizeAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {optimizeAlert}
              </p>
            )}
            
            {translateAlert && (
              <p className={`text-sm ${translateAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {translateAlert}
              </p>
            )}
            
            {/* Visa optimerade produkter eller UI-element */}
            {phase === 'readyToExport' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-4">
                  {jobType === 'product_texts' 
                    ? `Optimerade produkter (${selectedIds.size} av ${parsedProducts.length})`
                    : `UI-element (${selectedIds.size} av ${parsedUIStrings.length})`
                  }
                </h3>
                
                {/* Urvalsknappar */}
                <div className="flex flex-wrap gap-2 mb-4">
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
                </div>

                {/* Produktlista eller UI-element lista */}
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === (jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length) && (jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length) > 0}
                            onChange={selectedIds.size === (jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length) ? handleDeselectAll : handleSelectAll}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        {jobType === 'product_texts' ? (
                          <>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRODUKTNAMN</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BESKRIVNING (SV)</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OPTIMERAD TEXT (SV)</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OPTIMERAD TEXT (NO)</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OPTIMERAD TEXT (DK)</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">STATUS</th>
                          </>
                        ) : (
                          <>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAMN</th>
                            {parsedUIStrings.length > 0 && Object.keys(parsedUIStrings[0].values).map(locale => (
                              <th key={locale} className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{locale}</th>
                            ))}
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">STATUS</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {jobType === 'product_texts' ? (
                        parsedProducts.slice(0, visibleRows).map((product, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(index)}
                                onChange={() => handleProductToggle(index)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-1 text-xs font-bold text-gray-900">
                              <div className="truncate" title={product.name_sv}>
                                {product.name_sv}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-xs text-gray-500">
                              <div 
                                className="cursor-pointer hover:bg-gray-100 truncate"
                                onClick={() => handleCellClick(product, 'description_sv')}
                                title="Klicka för att redigera"
                              >
                                {product.description_sv.length > 40 
                                  ? `${product.description_sv.substring(0, 40)}...` 
                                  : product.description_sv}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-xs text-gray-500">
                              {product.optimized_sv ? (
                                <div 
                                  className="cursor-pointer hover:bg-gray-100 truncate"
                                  onClick={() => handleCellClick(product, 'optimized_sv')}
                                  title="Klicka för att redigera"
                                >
                                  <div className="truncate" dangerouslySetInnerHTML={{ 
                                    __html: formatOptimizedText(product.optimized_sv.substring(0, 40) + (product.optimized_sv.length > 40 ? '...' : ''))
                                  }} />
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-xs text-gray-500">
                              {product.translated_no ? (
                                <div 
                                  className="cursor-pointer hover:bg-gray-100 truncate"
                                  onClick={() => handleCellClick(product, 'translated_no')}
                                  title="Klicka för att redigera"
                                >
                                  {product.translated_no.length > 40 
                                    ? `${product.translated_no.substring(0, 40)}...` 
                                    : product.translated_no}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-xs text-gray-500">
                              {product.translated_da ? (
                                <div 
                                  className="cursor-pointer hover:bg-gray-100 truncate"
                                  onClick={() => handleCellClick(product, 'translated_da' as any)}
                                  title="Klicka för att redigera"
                                >
                                  {product.translated_da.length > 40 
                                    ? `${product.translated_da.substring(0, 40)}...` 
                                    : product.translated_da}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-xs text-gray-700">
                              {getProductStatus(product)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        parsedUIStrings.slice(0, visibleRows).map((uiItem, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(index)}
                                onChange={() => handleProductToggle(index)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2 py-1 text-xs font-bold text-gray-900">
                              <div className="truncate" title={uiItem.name}>
                                {uiItem.name}
                              </div>
                            </td>
                            {Object.entries(uiItem.values).map(([locale, value]) => (
                              <td key={locale} className="px-2 py-1 text-xs text-gray-500">
                                <div className="truncate" title={value as string}>
                                  {value || '(tom)'}
                                </div>
                              </td>
                            ))}
                            <td className="px-2 py-1 text-xs text-gray-700">
                              {uiItem.status || 'pending'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Visa fler-knapp */}
                {visibleRows < (jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length) && (
                  <div className="text-center mt-4">
                    <button
                      onClick={handleShowMore}
                      className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                    >
                      Visa fler ({Math.min(200, (jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length) - visibleRows)} till)
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Visar {Math.min(visibleRows, jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length)} av {jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length} {jobType === 'product_texts' ? 'produkter' : 'UI-element'}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Debug text - only in development */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-gray-500">
                Prompt-inställningar används lokalt (nästa steg kopplar in servern).
              </p>
            )}
          </div>
        </div>
        )}

        {/* UI Strings Summary - endast för UI-element */}
        {jobType === 'ui_strings' && phase === 'uploaded' && parsedUIStrings.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">D) UI-element Sammanfattning</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Import Sammanfattning</h3>
                <p className="text-blue-800">
                  ✅ {parsedUIStrings.length} UI-element importerade
                </p>
                <p className="text-blue-800">
                  📝 Språk hittade: {Object.keys(parsedUIStrings[0]?.values || {}).join(', ')}
                </p>
                <p className="text-blue-800 text-sm mt-2">
                  UI-elementen är redo för batch-skapande. Ingen optimering eller översättning behövs.
                </p>
              </div>
            </div>
          </div>
        )}

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

        {/* Regenerate Modal */}
        {showRegenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Regenerera produkttexter</h3>
              <p className="text-sm text-gray-600 mb-4">
                Välj om du vill regenerera texter för hela batchen eller endast markerade produkter.
              </p>
              
              <div className="space-y-3 mb-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="regenerateScope"
                    value="all"
                    checked={regenerateScope === 'all'}
                    onChange={(e) => setRegenerateScope(e.target.value as 'all' | 'selected')}
                    className="mr-2"
                  />
                  Hela batchen ({parsedProducts.length} produkter)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="regenerateScope"
                    value="selected"
                    checked={regenerateScope === 'selected'}
                    onChange={(e) => setRegenerateScope(e.target.value as 'all' | 'selected')}
                    className="mr-2"
                  />
                  Endast markerade produkter ({selectedIds.size} produkter)
                </label>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleRegenerate}
                  className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                >
                  Regenerera
                </button>
                <button
                  onClick={() => setShowRegenerateModal(false)}
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
