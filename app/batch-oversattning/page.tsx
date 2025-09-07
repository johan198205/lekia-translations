'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductDrawer from '../components/ProductDrawer'
import ProgressBar from '../components/ProgressBar'
import Stepper from '../components/Stepper'
import ModernStepCard from '../components/ModernStepCard'
import ModernSummaryCard from '../components/ModernSummaryCard'
import ModernRadioCard from '../components/ModernRadioCard'
import { getLanguageDisplayName } from '@/lib/languages'

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
  translated_en?: string;
  translated_de?: string;
  translated_fr?: string;
  translated_es?: string;
  translated_it?: string;
  translated_pt?: string;
  translated_nl?: string;
  translated_pl?: string;
  translated_ru?: string;
  translated_fi?: string;
  translations?: string;
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
  token_count: number;
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
type SourceType = 'existing' | 'new' | null

function BatchOversattningContent() {
  const searchParams = useSearchParams()
  const [file, setFile] = useState<File | null>(null)
  const [jobType, setJobType] = useState<'product_texts' | 'ui_strings'>('product_texts')
  const [sourceType, setSourceType] = useState<SourceType>(null)
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
  const [currentStep, setCurrentStep] = useState<number>(1)
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
  const [translationLanguage, setTranslationLanguage] = useState<string | null>(null)
  const [translationLanguages, setTranslationLanguages] = useState<string[]>([])
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerField, setDrawerField] = useState<'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | 'translated_en' | 'translated_de' | 'translated_fr' | 'translated_es' | 'translated_it' | 'translated_pt' | 'translated_nl' | 'translated_pl' | 'translated_ru' | 'translated_fi' | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'upload', id: string, name: string } | null>(null)
  
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

  // Load jobType from URL params and prompt settings from localStorage on mount
  useEffect(() => {
    const urlJobType = searchParams.get('jobType') as 'product_texts' | 'ui_strings'
    if (urlJobType && (urlJobType === 'product_texts' || urlJobType === 'ui_strings')) {
      setJobType(urlJobType)
    }

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
  }, [searchParams])

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

        // Load translation languages from settings
        const settingsResponse = await fetch('/api/settings/openai')
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json()
          if (settingsData.translationLanguages) {
            try {
              const parsed = JSON.parse(settingsData.translationLanguages)
              if (Array.isArray(parsed)) {
                setTranslationLanguages(parsed)
              }
            } catch (error) {
              console.warn('Failed to parse translation languages:', error)
            }
          }
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
    setSourceType('new') // Set sourceType when file is selected
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
    setSourceType(null)
    setError('')
    setUploadAlert('')
    setParsedProducts([])
    setParsedUIStrings([])
    setSelectedIds(new Set())
    setSelectedUpload(null)
    setUploadId('')
    setPhase('idle')
    setBatchId('')
    setSelectedBatch(null)
    setCurrentStep(1) // Reset wizard to step 1 when job type changes
  }

  const handleUploadSelect = async (upload: Upload) => {
    setSelectedUpload(upload)
    setSelectedBatch(null) // Clear batch selection
    setUploadId(upload.id)
    setFile(null)
    setSourceType('existing') // Ensure sourceType is set
    setError('')
    setUploadAlert('')
    
    // Filter batches for this upload
    const uploadBatches = batches.filter(batch => batch.upload_id === upload.id)
    setAvailableBatches(uploadBatches)
    
    if (uploadBatches.length > 0) {
      setUploadAlert(`✅ Upload vald: ${upload.filename}. Välj batch nedan eller skapa ny.`)
    } else {
      setUploadAlert(`✅ Upload vald: ${upload.filename}. Inga befintliga batchar. Skapa ny batch.`)
    }
  }

  const handleLoadUploadData = async (upload: Upload) => {
    // Filter batches for this upload
    const uploadBatches = batches.filter(batch => batch.upload_id === upload.id)
    
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
          setCurrentStep(2)
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
        setCurrentStep(3) // Advance to step 3: Optimize & Translate
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
          setCurrentStep(2)
          setUploadAlert(`✅ Fil uppladdad! ${data.products.length} produkter hittades.`)
        } else if (jobType === 'ui_strings' && data.uiStrings) {
          setProductsCount(data.uiStrings.length)
          setParsedUIStrings(data.uiStrings)
          setSelectedIds(new Set(data.uiStrings.map((_: any, index: number) => index)))
          setUploadId(data.uploadId)
          setPhase('uploaded')
          setCurrentStep(2)
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
      
      console.log('Creating batch with:', {
        upload_id: uploadId,
        job_type: jobType,
        selected_ids: selectedItemIds,
        selectedIdsSize: selectedIds.size,
        parsedProductsLength: parsedProducts.length,
        parsedUIStringsLength: parsedUIStrings.length
      })
      
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
        
        // Load the batch data to show the items immediately and jump to step 3
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
        
        setCurrentStep(3) // Advance to step 3: Optimize & Translate
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

  const handleTranslateSpecific = async (language: string) => {
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
    
    // Check translations from new translations field
    let translatedLanguages: string[] = []
    if (product.translations) {
      try {
        const translations = JSON.parse(product.translations)
        translatedLanguages = Object.keys(translations).filter(lang => 
          translations[lang] && translations[lang].trim()
        )
      } catch (error) {
        console.warn('Failed to parse translations for status:', error)
      }
    }
    
    // Fallback to legacy fields for backward compatibility
    if (translatedLanguages.length === 0) {
      const hasNo = product.translated_no && product.translated_no.trim()
      const hasDa = product.translated_da && product.translated_da.trim()
      const hasEn = product.translated_en && product.translated_en.trim()
      const hasDe = product.translated_de && product.translated_de.trim()
      const hasFr = product.translated_fr && product.translated_fr.trim()
      const hasEs = product.translated_es && product.translated_es.trim()
      const hasIt = product.translated_it && product.translated_it.trim()
      const hasPt = product.translated_pt && product.translated_pt.trim()
      const hasNl = product.translated_nl && product.translated_nl.trim()
      const hasPl = product.translated_pl && product.translated_pl.trim()
      const hasRu = product.translated_ru && product.translated_ru.trim()
      const hasFi = product.translated_fi && product.translated_fi.trim()
      
      if (hasNo) translatedLanguages.push('no')
      if (hasDa) translatedLanguages.push('da')
      if (hasEn) translatedLanguages.push('en')
      if (hasDe) translatedLanguages.push('de')
      if (hasFr) translatedLanguages.push('fr')
      if (hasEs) translatedLanguages.push('es')
      if (hasIt) translatedLanguages.push('it')
      if (hasPt) translatedLanguages.push('pt')
      if (hasNl) translatedLanguages.push('nl')
      if (hasPl) translatedLanguages.push('pl')
      if (hasRu) translatedLanguages.push('ru')
      if (hasFi) translatedLanguages.push('fi')
    }
    
    if (translatedLanguages.length === 0) {
      return 'optimized'
    } else if (translatedLanguages.length === 1) {
      return `translated (${translatedLanguages[0]})`
    } else {
      return `translated (${translatedLanguages.join(', ')})`
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
          setSelectedBatch(null)
          setUploadId('')
          setParsedProducts([])
          setParsedUIStrings([])
          setSelectedIds(new Set())
          setPhase('idle')
          setAvailableBatches([])
        }
        setShowDeleteModal(false)
        setDeleteTarget(null)
      } else {
        const errorData = await response.json()
        setUploadAlert(`❌ Fel vid radering av upload: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setUploadAlert('❌ Nätverksfel vid radering av upload')
    }
  }

  const openDeleteModal = (type: 'upload', id: string, name: string) => {
    setDeleteTarget({ type, id, name })
    setShowDeleteModal(true)
    // Scroll to bottom to show the modal
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
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
                  translated_da: updatedProduct.translated_da || product.translated_da,
                  translated_en: updatedProduct.translated_en || product.translated_en,
                  translated_de: updatedProduct.translated_de || product.translated_de,
                  translated_fr: updatedProduct.translated_fr || product.translated_fr,
                  translated_es: updatedProduct.translated_es || product.translated_es,
                  translated_it: updatedProduct.translated_it || product.translated_it,
                  translated_pt: updatedProduct.translated_pt || product.translated_pt,
                  translated_nl: updatedProduct.translated_nl || product.translated_nl,
                  translated_pl: updatedProduct.translated_pl || product.translated_pl,
                  translated_ru: updatedProduct.translated_ru || product.translated_ru,
                  translated_fi: updatedProduct.translated_fi || product.translated_fi
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

  // Define stepper steps according to requirements
  const stepperSteps = [
    { key: 'source', label: 'Välj källa' },
    { key: 'select', label: 'Välj rader & Skapa batch' },
    { key: 'optimize', label: 'Optimera & Översätt' },
    { key: 'export', label: 'Exportera' },
  ]

  return (
    <div style={{ flex: 1, padding: '2rem', background: '#fcfbf7', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="start-header" style={{ marginBottom: '4rem' }}>
          <h1 className="start-title">
            Optimering & översättning
          </h1>
          <p className="start-subtitle">
            {jobType === 'product_texts' ? 'Optimerar och översätter produkttexter' : 'Översätter UI-element och webbplatstexter'}
          </p>
        </div>
        
        <Stepper 
          currentStep={currentStep}
          steps={stepperSteps}
        />
        
        <div className="wizard-content">
        {/* Step 1: Source Selection - Only show if currentStep === 1 */}
        {currentStep === 1 && (
          <ModernStepCard
            stepNumber={1}
            title="Välj källa"
            description="Välj om du vill fortsätta med en befintlig upload eller ladda upp en ny fil"
            icon="📁"
            isActive={true}
            isCompleted={false}
            ctaText={(() => {
              console.log('CTA check:', { sourceType, selectedUpload: !!selectedUpload, selectedBatch: !!selectedBatch, file: !!file })
              return (sourceType === 'existing' && selectedUpload && selectedBatch) || 
                     (sourceType === 'new' && file)
                ? "Fortsätt till nästa steg" 
                : undefined
            })()}
            onCtaClick={async () => {
              if (sourceType === 'existing' && selectedUpload && selectedBatch) {
                // For existing batches, the step transition is handled in handleBatchSelect
                // This CTA is now redundant since batch selection automatically advances to step 3
                console.log('CTA clicked for existing batch - step transition handled by handleBatchSelect')
              } else if (sourceType === 'new' && file) {
                // For new files, upload (handleUpload will set step 2)
                await handleUpload()
              }
            }}
            ctaDisabled={
              !sourceType || 
              (sourceType === 'existing' && (!selectedUpload || !selectedBatch)) || 
              (sourceType === 'new' && !file)
            }
          >
          <div className="space-y-4">
            {/* Jobbtyp-val */}
            <div className="space-y-2">
              <label htmlFor="jobTypeSelect" className="block text-sm font-medium text-gray-700" style={{ marginRight: '10px' }}>
                Jobbtyp:
              </label>
              <select
                id="jobTypeSelect"
                name="jobType"
                value={jobType}
                onChange={(e) => handleJobTypeChange(e.target.value as 'product_texts' | 'ui_strings')}
                className="mt-1 block w-full pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                style={{ padding: '10px' }}
              >
                <option value="product_texts">Produkttexter (befintligt)</option>
                <option value="ui_strings">UI-element / Webbplatstexter (NY)</option>
              </select>
            </div>

            {/* Radio cards for source selection */}
            <div className="space-y-3">
              <ModernRadioCard
                id="existing-upload"
                name="sourceType"
                value="existing"
                checked={sourceType === 'existing'}
                onChange={(value) => setSourceType(value as SourceType)}
                title="Fortsätt på befintlig upload"
                description="Välj från tidigare uppladdade filer"
                icon="📁"
              >
                {sourceType === 'existing' && (
                  <div className="space-y-2">
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
                          {upload.filename} ({upload.products_remaining} {jobType === 'product_texts' ? 'produkter' : 'UI-element'} kvar, {upload.batches_count} batches{upload.token_count > 0 ? `, ${upload.token_count} tokens` : ''})
                        </option>
                      ))}
                    </select>
                    
                    {selectedUpload && (
                      <ModernSummaryCard
                        title={selectedUpload.filename}
                        items={[
                          { label: 'Uppladdad', value: new Date(selectedUpload.upload_date).toLocaleDateString('sv-SE') },
                          { label: 'Totalt', value: selectedUpload.total_products },
                          { label: 'Kvar', value: selectedUpload.products_remaining },
                          { label: 'Batchar', value: selectedUpload.batches_count },
                          ...(selectedUpload.token_count > 0 ? [{ label: 'Tokens', value: selectedUpload.token_count }] : [])
                        ]}
                        onDelete={() => openDeleteModal('upload', selectedUpload.id, selectedUpload.filename)}
                        showDelete={true}
                      />
                    )}
                  </div>
                )}
              </ModernRadioCard>

              <ModernRadioCard
                id="new-file"
                name="sourceType"
                value="new"
                checked={sourceType === 'new'}
                onChange={(value) => setSourceType(value as SourceType)}
                title="Ladda upp ny fil"
                description="Importera en ny Excel-fil"
                icon="📤"
              >
                {sourceType === 'new' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileChange}
                      disabled={selectedBatch !== null}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                    {isUploading && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Laddar upp fil...</span>
                      </div>
                    )}
                  </div>
                )}
              </ModernRadioCard>
            </div>

            {uploadAlert && (
              <p className={`text-sm ${uploadAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {uploadAlert}
              </p>
            )}

            {/* Batch selection for existing uploads */}
            {sourceType === 'existing' && selectedUpload && availableBatches.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="batchSelect" className="block text-sm font-medium text-gray-700" style={{ marginRight: '10px' }}>
                  Välj befintlig batch:
                </label>
                <select
                  id="batchSelect"
                  value={selectedBatch?.id || ''}
                  onChange={(e) => {
                    const batch = availableBatches.find(b => b.id === e.target.value)
                    if (batch) {
                      handleBatchSelect(batch)
                    }
                  }}
                  className="mt-1 block w-full pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                style={{ padding: '10px' }}
                >
                  <option value="">-- Välj batch --</option>
                  {availableBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {`Batch ${batch.id.slice(-8)} - ${batch.total_products || 'N/A'} ${jobType === 'product_texts' ? 'produkter' : 'UI-element'} (${batch.status})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Create new batch option */}
            {sourceType === 'existing' && selectedUpload && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Eller skapa ny batch:
                </label>
                <button
                  onClick={() => {
                    setSelectedBatch(null)
                    // Load data for new batch creation
                    handleLoadUploadData(selectedUpload)
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  ➕ Skapa ny batch
                </button>
              </div>
            )}
          </div>
        </ModernStepCard>
        )}

        {/* Step 2: Row Selection & Batch Creation - Only show if currentStep === 2 */}
        {currentStep === 2 && (
          <ModernStepCard
            stepNumber={2}
            title="Välj rader & Skapa batch"
            description={`Välj ${jobType === 'product_texts' ? 'produkter' : 'UI-element'} att inkludera i batchen och skapa sedan batchen`}
            icon={jobType === 'product_texts' ? '📦' : '🌐'}
            isActive={currentStep >= 2}
            isCompleted={currentStep > 2}
            ctaText="Skapa batch"
            onCtaClick={async () => {
              await handleCreateBatch()
              // setCurrentStep(3) is now handled inside handleCreateBatch
            }}
            ctaDisabled={selectedIds.size === 0}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Välj {jobType === 'product_texts' ? 'produkter' : 'UI-element'} ({selectedIds.size} av {jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length})
                </h3>
              </div>
              {selectedIds.size === 0 && (
                <p className="text-sm text-red-600">⚠️ Välj minst en {jobType === 'product_texts' ? 'produkt' : 'UI-element'} för att skapa batch</p>
              )}
              {batchAlert && (
                <p className={`text-sm ${batchAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                  {batchAlert}
                </p>
              )}
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
          </ModernStepCard>
        )}



        {/* Step 3: Optimize & Translate - Only show if currentStep === 3 */}
        {currentStep === 3 && (
          <ModernStepCard
            stepNumber={3}
            title={jobType === 'product_texts' ? 'Optimera & Översätt' : 'Översätt'}
            description={jobType === 'product_texts' ? 'Optimerar svenska texter och översätter till norska och danska' : 'Översätter UI-element till norska'}
            icon={jobType === 'product_texts' ? '✨' : '🌐'}
            isActive={currentStep >= 3}
            isCompleted={currentStep > 3}
          >
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
                          {translationLanguages.map((langCode, index) => {
                            const colors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-red-600']
                            const hoverColors = ['hover:bg-blue-700', 'hover:bg-green-700', 'hover:bg-purple-700', 'hover:bg-orange-700', 'hover:bg-pink-700', 'hover:bg-indigo-700', 'hover:bg-teal-700', 'hover:bg-red-700']
                            const colorClass = colors[index % colors.length]
                            const hoverClass = hoverColors[index % hoverColors.length]
                            
                            return (
                              <button
                                key={langCode}
                                onClick={() => handleTranslateSpecific(langCode)}
                                disabled={!batchId || !allHaveOptimizedSv || !hasSelectedProducts || phase === 'translating'}
                                className={`${colorClass} text-white px-4 py-2 rounded-md ${hoverClass} disabled:bg-gray-400 disabled:cursor-not-allowed`}
                                title={!allHaveOptimizedSv ? "Kräver optimerad svensk text" : ""}
                              >
                                Översätt till {getLanguageDisplayName(langCode)}
                              </button>
                            )
                          })}
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {/* Översättningsknappar för UI-element */}
                    {translationLanguages.map((langCode, index) => {
                      const colors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-red-600']
                      const hoverColors = ['hover:bg-blue-700', 'hover:bg-green-700', 'hover:bg-purple-700', 'hover:bg-orange-700', 'hover:bg-pink-700', 'hover:bg-indigo-700', 'hover:bg-teal-700', 'hover:bg-red-700']
                      const colorClass = colors[index % colors.length]
                      const hoverClass = hoverColors[index % hoverColors.length]
                      
                      return (
                        <button
                          key={langCode}
                          onClick={() => handleTranslateSpecific(langCode)}
                          disabled={!batchId || selectedIds.size === 0 || phase === 'translating'}
                          className={`${colorClass} text-white px-4 py-2 rounded-md ${hoverClass} disabled:bg-gray-400 disabled:cursor-not-allowed`}
                        >
                          Översätt till {getLanguageDisplayName(langCode)}
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
              
              {phase === 'optimizing' && (
                <ProgressBar
                  percent={progress.percent}
                  done={progress.done}
                  total={progress.total}
                  counts={progress.counts}
                  startTime={optimizationStartTime}
                  jobType={jobType}
                  phase="optimizing"
                />
              )}

              {phase === 'translating' && (
                <ProgressBar
                  percent={progress.percent}
                  done={progress.done}
                  total={progress.total}
                  counts={progress.counts}
                  startTime={translationStartTime}
                  jobType={jobType}
                  phase="translating"
                />
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
                              {translationLanguages.map((langCode) => (
                                <th key={langCode} className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  OPTIMERAD TEXT ({langCode.toUpperCase()})
                                </th>
                              ))}
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
                                    <div className="truncate font-mono text-xs">
                                      {product.optimized_sv.substring(0, 40) + (product.optimized_sv.length > 40 ? '...' : '')}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              {translationLanguages.map((langCode) => {
                                const fieldName = `translated_${langCode}` as keyof Product;
                                const translatedText = product[fieldName] as string;
                                return (
                                  <td key={langCode} className="px-2 py-1 text-xs text-gray-500">
                                    {translatedText ? (
                                      <div 
                                        className="cursor-pointer hover:bg-gray-100 truncate"
                                        onClick={() => handleCellClick(product, fieldName as any)}
                                        title="Klicka för att redigera"
                                      >
                                        {translatedText.length > 40 
                                          ? `${translatedText.substring(0, 40)}...` 
                                          : translatedText}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                );
                              })}
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
            </div>
          </ModernStepCard>
        )}


        {/* Step 4: Export - Only show if currentStep === 4 */}
        {currentStep === 4 && (
          <ModernStepCard
            stepNumber={4}
            title="Exportera"
            description="Ladda ner den färdiga Excel-filen med alla översättningar"
            icon="📥"
            isActive={currentStep >= 4}
            isCompleted={false}
            ctaText="Exportera Excel"
            onCtaClick={handleExport}
            ctaDisabled={!batchId}
          >
            <div className="space-y-4">
              <ModernSummaryCard
                title="Batch sammanfattning"
                items={[
                  { label: 'Antal rader', value: jobType === 'product_texts' ? parsedProducts.length : parsedUIStrings.length },
                  { label: 'Språk klara', value: jobType === 'product_texts' ? 'SV, NO, DK' : 'SV, NO' }
                ]}
              />
              {exportAlert && (
                <p className={`text-sm ${exportAlert.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                  {exportAlert}
                </p>
              )}
            </div>
          </ModernStepCard>
        )}


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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">
                Bekräfta radering
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Är du säker på att du vill radera uploaden "{deleteTarget.name}"?
                Detta kommer också att radera alla relaterade batchar och produkter/UI-element.
              </p>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleDeleteUpload}
                  style={{
                    background: '#1d40b0',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1e3a8a'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1d40b0'
                  }}
                >
                  🗑️ Radera
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteTarget(null)
                  }}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#4b5563'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#6b7280'
                  }}
                >
                  ✕ Avbryt
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

export default function BatchOversattningPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BatchOversattningContent />
    </Suspense>
  )
}
