'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductDrawer from '../components/ProductDrawer'
import ProgressBar from '../components/ProgressBar'
import Stepper from '../components/Stepper'
import ModernStepCard from '../components/ModernStepCard'
import ModernSummaryCard from '../components/ModernSummaryCard'
import ModernRadioCard from '../components/ModernRadioCard'
import FlagTranslateButton from '../components/FlagTranslateButton'
import { getLanguageDisplayName } from '@/lib/languages'
import { codeToCountry } from '@/lib/flag-utils'

interface Progress {
  percent: number
  done: number
  total: number
  counts: {
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

interface Brand {
  id: string;
  name_sv: string;
  description_sv: string;
  attributes?: string;
  tone_hint?: string;
  short_sv?: string;
  long_html_sv?: string;
  translations?: string;
  status?: string;
  batch_id?: string;
  error_message?: string;
}

interface Upload {
  id: string;
  filename: string;
  upload_date: string;
  total_products: number;
  products_remaining: number;
  batches_count: number;
  job_type: 'product_texts' | 'ui_strings' | 'brands';
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
  job_type: 'product_texts' | 'ui_strings' | 'brands';
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
  const [parsedBrands, setParsedBrands] = useState<Brand[]>([])
  const [brandsHeaders, setBrandsHeaders] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
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

  // Debug: log incoming Excel headers and sample values to validate mapping
  useEffect(() => {
    try {
      if (jobType === 'product_texts' && parsedProducts && parsedProducts.length > 0) {
        const sample = parsedProducts[0] as any;
        const rd = sample?.raw_data;
        const raw = typeof rd === 'string' ? JSON.parse(rd) : (rd || {});
        const keys = Object.keys(raw || {});
        console.log('[DEBUG] First product raw_data keys:', keys);
        const preview: Record<string, any> = {};
        keys.slice(0, 20).forEach(k => { preview[k] = raw[k]; });
        console.log('[DEBUG] First product raw_data preview:', preview);
        // Heuristics for short description columns
        const candidates = keys.filter(k => k.toLowerCase().includes('kort') && k.toLowerCase().includes('beskriv'));
        console.log('[DEBUG] Candidate short-description columns:', candidates, candidates.map(k => raw[k]));
      }
    } catch (e) {
      console.warn('[DEBUG] Failed to inspect raw_data', e);
    }
  }, [jobType, parsedProducts]);

  // Ensure headers are available for brands even if API didn't include them
  useEffect(() => {
    if (jobType === 'brands' && brandsHeaders.length === 0 && parsedBrands.length > 0) {
      try {
        const first = parsedBrands[0] as any
        const rd = first?.raw_data
        const obj = typeof rd === 'string' ? JSON.parse(rd) : rd
        const inferred = obj && typeof obj === 'object' ? Object.keys(obj) : []
        if (inferred.length > 0) setBrandsHeaders(inferred)
      } catch {
        // ignore
      }
    }
  }, [jobType, parsedBrands, brandsHeaders.length])

  // Auto-select all products when parsedProducts changes
  useEffect(() => {
    console.log('[DEBUG] parsedProducts changed:', parsedProducts.length)
    if (parsedProducts.length > 0 && selectedProductIds.size === 0) {
      setSelectedProductIds(new Set(parsedProducts.map((product: Product) => product.id)))
    }
  }, [parsedProducts, selectedProductIds.size])

  
  // Filter uploads based on selected jobType
  const filteredUploads = uploads.filter(upload => upload.job_type === jobType)
  const [regenerateScope, setRegenerateScope] = useState<'all' | 'selected'>('all')
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [progress, setProgress] = useState<Progress>({
    percent: 0,
    done: 0,
    total: 0,
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
  const [optimizeSv, setOptimizeSv] = useState<boolean>(false)
  const [selectedTargetLangs, setSelectedTargetLangs] = useState<string[]>([])
  const [batchTargetLanguages, setBatchTargetLanguages] = useState<string[]>([])
  const [requiredLanguages, setRequiredLanguages] = useState<string[]>([])
  // Action selection state
  const [actionOptimize, setActionOptimize] = useState<boolean>(false)
  const [actionTranslate, setActionTranslate] = useState<boolean>(false)
  // Field selection per action (UI only for now)
  const fieldOptions = [
    { key: 'name_sv', label: 'Namn, sv-SE' },
    { key: 'short_sv', label: 'Kort beskrivning, sv-SE' },
    { key: 'description_html_sv', label: 'Beskrivning (id: DescriptionHtml), sv-SE' },
    { key: 'seo_title_sv', label: 'Sökmotoranpassad titel, sv-SE' },
    { key: 'seo_description_sv', label: 'Sökmotoranpassad beskrivning, sv-SE' },
  ] as const
  const [optimizeFields, setOptimizeFields] = useState<Set<string>>(new Set())
  const [translateFields, setTranslateFields] = useState<Set<string>>(new Set())
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerField, setDrawerField] = useState<'description_sv' | 'optimized_sv' | 'translated_no' | 'translated_da' | 'translated_en' | 'translated_de' | 'translated_fr' | 'translated_es' | 'translated_it' | 'translated_pt' | 'translated_nl' | 'translated_pl' | 'translated_ru' | 'translated_fi' | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'upload' | 'batch', id: string, name: string, count?: number } | null>(null)
  
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
  
  // Keep legacy optimizeSv in sync with actionOptimize for processing
  useEffect(() => {
    setOptimizeSv(actionOptimize)
  }, [actionOptimize])

  const eventSourceRef = useRef<EventSource | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load batch data when entering step 3
  useEffect(() => {
    console.log('[DEBUG] currentStep changed to:', currentStep, 'batchId:', batchId, 'selectedBatch:', !!selectedBatch)
    if (currentStep === 3 && batchId && !selectedBatch && jobType === 'product_texts') {
      console.log('[DEBUG] Loading batch data for step 3, batchId:', batchId)
      const existingBatch = availableBatches.find(b => b.id === batchId)
      if (existingBatch) {
        handleBatchSelect(existingBatch)
      } else {
        fetch(`/api/batches/${batchId}`)
          .then(response => response.json())
          .then(data => {
            console.log('[DEBUG] Loaded batch data for step 3:', data)
            setParsedProducts(data.products || [])
            setSelectedProductIds(new Set(data.products?.map((p: Product) => p.id) || []))
          })
          .catch(error => console.error('[DEBUG] Failed to load batch data:', error))
      }
    }
  }, [currentStep, batchId, selectedBatch, jobType, availableBatches])

  // Load jobType from URL params and prompt settings from localStorage on mount
  useEffect(() => {
    const urlJobType = searchParams.get('jobType') as 'product_texts' | 'ui_strings'
    if (urlJobType && (urlJobType === 'product_texts' || urlJobType === 'ui_strings' || urlJobType === 'brands')) {
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

        // Set available translation languages (no longer from settings)
        setTranslationLanguages(['da', 'nb', 'no', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'fi'])
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

  // Progress updates are handled by SSE events, no need for polling

  // Timer updates are handled by the ProgressBar component itself

  // Timer updates are handled by the ProgressBar component itself

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

  const handleJobTypeChange = (newJobType: 'product_texts' | 'ui_strings' | 'brands') => {
    setJobType(newJobType)
    setFile(null)
    setSourceType(null)
    setError('')
    setUploadAlert('')
    setParsedProducts([])
    setParsedUIStrings([])
    setParsedBrands([])
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
        // Load upload metadata first
        const metaResponse = await fetch(`/api/uploads/${upload.id}/meta`)
        let detectedLanguages: string[] = []
        if (metaResponse.ok) {
          const metaData = await metaResponse.json()
          detectedLanguages = metaData.meta?.detectedLanguages || []
          setRequiredLanguages(detectedLanguages)
          // Do not auto-select; prefill required list only
          setBatchTargetLanguages([])
        }

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
            setSelectedProductIds(new Set(data.products.map((product: Product) => product.id)))
            setUploadAlert(`✅ Upload vald: ${upload.filename} (${data.products.length} produkter)`)
          } else {
            setParsedUIStrings(data.uiItems)
            setProductsCount(data.uiItems.length)
            setSelectedIds(new Set(data.uiItems.map((_: any, index: number) => index)))
            const detectedText = detectedLanguages.length > 0 ? `. Upptäckta språk: ${detectedLanguages.join(', ')}` : ''
            setUploadAlert(`✅ Upload vald: ${upload.filename} (${data.uiItems.length} UI-element)${detectedText}`)
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
          setSelectedProductIds(new Set(data.products.map((product: Product) => product.id)))
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
        
        // Load target languages from batch
        if (data.targetLanguages) {
          try {
            const targetLangs = JSON.parse(data.targetLanguages)
            setSelectedTargetLangs(targetLangs)
          } catch (error) {
            console.warn('Failed to parse batch targetLanguages:', error)
            setSelectedTargetLangs([])
          }
        } else {
          // Fallback for old batches without targetLanguages - detect from existing translations
          console.warn('Batch has no targetLanguages, detecting from existing translations')
          
          // Detect languages from existing translations in the data
          const detectedLanguages = new Set<string>()
          
          if (batch.job_type === 'product_texts' && data.products) {
            // Check product translations
            data.products.forEach((product: any) => {
              const translationFields = ['translated_da', 'translated_nb', 'translated_no', 'translated_en', 'translated_de', 'translated_fr', 'translated_es', 'translated_it', 'translated_pt', 'translated_nl', 'translated_pl', 'translated_ru', 'translated_fi']
              translationFields.forEach(field => {
                if (product[field] && product[field].trim()) {
                  const langCode = field.replace('translated_', '')
                  detectedLanguages.add(langCode)
                }
              })
            })
          } else if (batch.job_type === 'ui_strings' && data.ui_items) {
            // Check UI item translations
            data.ui_items.forEach((item: any) => {
              try {
                const values = JSON.parse(item.values)
                Object.keys(values).forEach(key => {
                  if (key !== 'sv' && values[key] && values[key].trim()) {
                    detectedLanguages.add(key)
                  }
                })
              } catch (error) {
                console.warn('Failed to parse UI item values:', error)
              }
            })
          }
          
          const detectedLangs = Array.from(detectedLanguages).sort()
          if (detectedLangs.length > 0) {
            setSelectedTargetLangs(detectedLangs)
            console.log('Detected languages from existing translations:', detectedLangs)
          } else {
            setSelectedTargetLangs(['da', 'nb', 'no']) // Ultimate fallback
          }
        }
        
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
    console.log('[UPLOAD] Starting upload process...')
    console.log('[UPLOAD] File:', file)
    console.log('[UPLOAD] JobType:', jobType)
    
    if (!file || isUploading) {
      console.log('[UPLOAD] Aborting - no file or already uploading')
      return
    }

    setIsUploading(true)
    setError('')
    setUploadAlert('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('jobType', jobType)
    
    console.log('[UPLOAD] FormData created, sending request...')

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[UPLOAD] Response data:', data)
        console.log('[UPLOAD] Products array:', data.products)
        console.log('[UPLOAD] Products length:', data.products?.length)
        
        if (jobType === 'product_texts' && data.products) {
          setProductsCount(data.products.length)
          setParsedProducts(data.products)
          setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
          setSelectedProductIds(new Set(data.products.map((product: Product) => product.id)))
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
          const detectedLanguages = data.meta?.detectedLanguages || []
          
          // Set detected languages
          setRequiredLanguages(detectedLanguages)
          // Do not auto-select detected languages
          setBatchTargetLanguages([])
          
          setUploadAlert(`✅ Fil uppladdad! ${data.uiStrings.length} UI-element hittades. Upptäckta språk: ${locales.join(', ')}. Välj vilka språk du vill översätta.`)
        } else if (jobType === 'brands' && data.brands) {
          setProductsCount(data.brands.length)
          setParsedBrands(data.brands)
          setSelectedIds(new Set(data.brands.map((_: any, index: number) => index)))
          setUploadId(data.uploadId)
          setPhase('uploaded')
          setCurrentStep(2)
          setUploadAlert(`✅ Fil uppladdad! ${data.brands.length} varumärken hittades.`)
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
      } else if (jobType === 'ui_strings') {
        // Get selected UI item IDs
        selectedItemIds = Array.from(selectedIds).map(index => parsedUIStrings[index]?.id).filter(Boolean)
      } else if (jobType === 'brands') {
        // Get selected brand IDs
        selectedItemIds = Array.from(selectedIds).map(index => parsedBrands[index]?.id).filter(Boolean)
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
          selected_ids: selectedItemIds,
          target_languages: batchTargetLanguages
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
              console.log('[DEBUG] Setting parsedProducts from batch data:', batchData.products.length)
              console.log('[DEBUG] Batch data products:', batchData.products)
              setParsedProducts(batchData.products)
              // Set selectedProductIds to include all products in the batch
              setSelectedProductIds(new Set(batchData.products.map((product: Product) => product.id)))
            } else if (jobType === 'ui_strings' && batchData.ui_items) {
              const uiItems = batchData.ui_items.map((item: any) => ({
                id: item.id,
                name: item.name,
                values: JSON.parse(item.values),
                status: item.status
              }))
              setParsedUIStrings(uiItems)
              // Set selectedIds to include all UI items in the batch
              setSelectedIds(new Set(uiItems.map((_: any, index: number) => index)))
            }
            
            // Set target languages from batch
            if (batchData.targetLanguages) {
              try {
                const targetLangs = JSON.parse(batchData.targetLanguages)
                setSelectedTargetLangs(targetLangs)
              } catch (error) {
                console.warn('Failed to parse batch targetLanguages:', error)
              }
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
        : selectedUpload.job_type === 'ui_strings'
        ? `/api/uploads/${selectedUpload.id}/ui-items`
        : `/api/uploads/${selectedUpload.id}/brands`
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        if (selectedUpload.job_type === 'product_texts') {
          setParsedProducts(data.products)
          setProductsCount(data.products.length)
          setSelectedIds(new Set(data.products.map((_: any, index: number) => index)))
          setSelectedProductIds(new Set(data.products.map((product: Product) => product.id)))
          setUploadAlert(`✅ ${data.products.length} återstående produkter laddade. Välj produkter nedan och klicka "Skapa batch".`)
        } else if (selectedUpload.job_type === 'ui_strings') {
          setParsedUIStrings(data.uiItems)
          setProductsCount(data.uiItems.length)
          setSelectedIds(new Set(data.uiItems.map((_: any, index: number) => index)))
          setUploadAlert(`✅ ${data.uiItems.length} återstående UI-element laddade. Välj UI-element nedan och klicka "Skapa batch".`)
        } else if (selectedUpload.job_type === 'brands') {
          // Disable brands in this flow – direct the user to settings
          setParsedProducts([])
          setParsedUIStrings([])
          setParsedBrands([])
          setBrandsHeaders([])
          setProductsCount(0)
          setSelectedIds(new Set())
          setUploadAlert('ℹ️ Varumärken hanteras inte här längre. Gå till Inställningar → Varumärken.')
          setPhase('idle')
          return
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

  const handleCombinedProcess = async () => {
    if (!batchId || selectedProductIds.size === 0) return

    try {
      // Show progress UI immediately
      setPhase('translating')
      setTranslateAlert('✅ Bearbetning startad! Följer framsteg...')
      setTranslationStartTime(Date.now())
      
      // Start SSE connection before POST
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      
      const eventSource = new EventSource(`/api/batches/${batchId}/events?selectedIndices=${Array.from(selectedProductIds).join(',')}`)
      eventSourceRef.current = eventSource
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[SSE] Received event:', data)
          
          if (data.type === 'progress') {
            setProgress(data.data)
          } else if (data.type === 'batch_completed' || data.type === 'end') {
            eventSource.close()
            eventSourceRef.current = null
            setPhase('readyToExport')
            setTranslateAlert('✅ Bearbetning klar!')
            setTranslationStartTime(null)
            // Fetch updated data to show the results
            fetchUpdatedProducts()
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        eventSource.close()
        eventSourceRef.current = null
      }

      // Make API call
      const response = await fetch(`/api/batches/${batchId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indices: Array.from(selectedProductIds),
          optimizeSv: optimizeSv,
          targetLangs: selectedTargetLangs,
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
        setTranslateAlert(`❌ Fel vid start av bearbetning: ${errorData.error || 'Okänt fel'}`)
        eventSource.close()
        eventSourceRef.current = null
        setPhase('readyToExport')
        setTranslationStartTime(null)
      }
    } catch (err) {
      setTranslateAlert('❌ Fel vid start av bearbetning: Nätverksfel')
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setPhase('readyToExport')
      setTranslationStartTime(null)
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

  const handleTargetLangChange = (lang: string) => {
    setSelectedTargetLangs(prev => {
      if (prev.includes(lang)) {
        return prev.filter(l => l !== lang)
      } else {
        return [...prev, lang]
      }
    })
  }

  const getCurrentItems = () => {
    return jobType === 'product_texts' ? parsedProducts : jobType === 'ui_strings' ? parsedUIStrings : parsedBrands
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

  const handleDeleteBatch = async () => {
    if (!deleteTarget) return

    try {
      const response = await fetch(`/api/batches/${deleteTarget.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAvailableBatches(prev => prev.filter(batch => batch.id !== deleteTarget.id))
        
        if (selectedBatch?.id === deleteTarget.id) {
          setSelectedBatch(null)
          setBatchId('')
          setParsedProducts([])
          setParsedUIStrings([])
          setSelectedIds(new Set())
          setPhase('batched')
          setCurrentStep(2)
        }
        setShowDeleteModal(false)
        setDeleteTarget(null)
        setUploadAlert('✅ Batch raderad')
      } else {
        const errorData = await response.json()
        setUploadAlert(`❌ Fel vid radering av batch: ${errorData.error || 'Okänt fel'}`)
      }
    } catch (err) {
      setUploadAlert('❌ Nätverksfel vid radering av batch')
    }
  }

  const openDeleteModal = (type: 'upload' | 'batch', id: string, name: string, count?: number) => {
    setDeleteTarget({ type, id, name, count })
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
              console.log('[CTA] CTA clicked!')
              console.log('[CTA] sourceType:', sourceType)
              console.log('[CTA] file:', !!file)
              console.log('[CTA] selectedUpload:', !!selectedUpload)
              console.log('[CTA] selectedBatch:', !!selectedBatch)
              
              if (sourceType === 'existing' && selectedUpload && selectedBatch) {
                // For existing batches, the step transition is handled in handleBatchSelect
                // This CTA is now redundant since batch selection automatically advances to step 3
                console.log('[CTA] Handling existing batch - step transition handled by handleBatchSelect')
              } else if (sourceType === 'new' && file) {
                // For new files, upload (handleUpload will set step 2)
                console.log('[CTA] Calling handleUpload for new file...')
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
                          {upload.filename} ({upload.products_remaining} {jobType === 'product_texts' ? 'produkter' : jobType === 'ui_strings' ? 'UI-element' : 'varumärken'} kvar, {upload.batches_count} batches{upload.token_count > 0 ? `, ${upload.token_count} tokens` : ''})
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
            description={`Välj ${jobType === 'product_texts' ? 'produkter' : jobType === 'ui_strings' ? 'UI-element' : 'varumärken'} att inkludera i batchen och skapa sedan batchen`}
            icon={jobType === 'product_texts' ? '📦' : jobType === 'ui_strings' ? '🌐' : '🏷️'}
            isActive={currentStep >= 2}
            isCompleted={currentStep > 2}
            ctaText="Skapa batch"
            onCtaClick={async () => {
              await handleCreateBatch()
              // Note: selected fields per action are captured in UI state for future API use
            }}
            ctaDisabled={selectedIds.size === 0}
          >
            <div className="space-y-4">

              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Välj {jobType === 'product_texts' ? 'produkter' : jobType === 'ui_strings' ? 'UI-element' : 'varumärken'} ({selectedIds.size} av {jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length})
                </h3>
              </div>
              {selectedIds.size === 0 && (
                <p className="text-sm text-red-600">⚠️ Välj minst en {jobType === 'product_texts' ? 'produkt' : jobType === 'ui_strings' ? 'UI-element' : 'varumärke'} för att skapa batch</p>
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === getCurrentItems().length && getCurrentItems().length > 0}
                          onChange={selectedIds.size === getCurrentItems().length ? handleDeselectAll : handleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      {jobType === 'brands' ? (
                        brandsHeaders.map((header, index) => (
                          <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                            {header}
                          </th>
                        ))
                      ) : jobType === 'product_texts' ? (
                        <>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikelnummer</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VariantAv</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn, sv-SE</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kort beskrivning, sv-SE</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beskrivning (id: DescriptionHtml), sv-SE</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sökmotoranpassad titel, sv-SE</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sökmotoranpassad beskrivning, sv-SE</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Värden</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getCurrentItems().slice(0, visibleRows).map((item, index) => {
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(index)}
                              onChange={() => handleProductToggle(index)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          {jobType === 'brands' ? (
                            (() => {
                              let rawData: Record<string, any> = {};
                              try {
                                const rd: any = (item as any).raw_data;
                                rawData = typeof rd === 'string' ? JSON.parse(rd) : (rd || {});
                              } catch {}
                              return brandsHeaders.map((header, hIdx) => {
                                const value = rawData[header] ?? '';
                                const display = String(value);
                                return (
                                  <td key={hIdx} className="px-3 py-2 text-sm text-gray-600">
                                    <div className="truncate" title={display}>{display}</div>
                                  </td>
                                )
                              })
                            })()
                          ) : jobType === 'product_texts' ? (
                            (() => {
                              // Display only the requested columns from raw_data, with sensible fallbacks
                              const desiredHeaders = [
                                'Artikelnummer',
                                'VariantAv',
                                'Namn, sv-SE',
                                'Kort beskrivning, sv-SE',
                                'Beskrivning (id: DescriptionHtml), sv-SE',
                                'Sökmotoranpassad titel, sv-SE',
                                'Sökmotoranpassad beskrivning, sv-SE'
                              ];
                              let rawData: Record<string, any> = {};
                              try {
                                const rd: any = (item as any).raw_data;
                                rawData = typeof rd === 'string' ? JSON.parse(rd) : (rd || {});
                              } catch {}
                              const product = item as Product;
                              // Normalize helper for flexible header matching
                              const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9åäöæøœ]+/g, '');
                              const toPlainString = (v: any): string => {
                                if (v == null) return '';
                                if (typeof v === 'string') return v;
                                if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                                // ExcelJS rich text
                                if (typeof v === 'object') {
                                  // Common shapes
                                  if (Array.isArray((v as any).richText)) {
                                    try {
                                      return ((v as any).richText as any[]).map((t: any) => t.text || '').join('');
                                    } catch {}
                                  }
                                  if (typeof (v as any).text === 'string') {
                                    return String((v as any).text);
                                  }
                                }
                                try { return JSON.stringify(v); } catch { return String(v); }
                              };
                              // Build normalized map once for O(1) lookups
                              const normalizedMap: Record<string, string> = {};
                              for (const [k, v] of Object.entries(rawData)) {
                                normalizedMap[normalizeKey(String(k))] = toPlainString(v);
                              }
                              const getByAliases = (aliases: string[], containsHints?: string[]): string => {
                                const normalizedAliases = aliases.map(normalizeKey);
                                for (const nk of normalizedAliases) {
                                  const val = normalizedMap[nk];
                                  if (val != null && String(val).trim() !== '') return String(val);
                                }
                                // Fuzzy: try contains-based hints (normalized substring match)
                                if (containsHints && containsHints.length > 0) {
                                  const hints = containsHints.map(normalizeKey);
                                  for (const [nk, val] of Object.entries(normalizedMap)) {
                                    if (hints.every(h => nk.includes(h))) {
                                      if (val != null && String(val).trim() !== '') return String(val);
                                    }
                                  }
                                }
                                return '';
                              };
                              const aliasMap: Record<string, string[]> = {
                                'Artikelnummer': ['Artikelnummer', 'Artikel nr', 'Art nr', 'Artikelnr', 'ArtNr', 'SKU', 'Artikelnummer*'],
                                'VariantAv': ['VariantAv', 'Variant Av', 'Variant-Av', 'VariantOf', 'Parent', 'Parent SKU'],
                                'Namn, sv-SE': ['Namn, sv-SE', 'Namn', 'Namn sv-SE', 'Produktnamn', 'Name', 'Product Name'],
                                'Kort beskrivning, sv-SE': ['Kort beskrivning, sv-SE', 'Kort beskrivning', 'Kort beskrivn', 'Kort text', 'Short description', 'Short desc'],
                                'Beskrivning (id: DescriptionHtml), sv-SE': ['Beskrivning (id: DescriptionHtml), sv-SE', 'Beskrivning, sv-SE', 'Beskrivning', 'Description', 'Long description', 'DescriptionHtml'],
                                'Sökmotoranpassad titel, sv-SE': ['Sökmotoranpassad titel, sv-SE', 'SEO-titel', 'SEO titel', 'Meta title', 'SEOTitle'],
                                'Sökmotoranpassad beskrivning, sv-SE': ['Sökmotoranpassad beskrivning, sv-SE', 'SEO-beskrivning', 'SEO beskrivning', 'Meta description', 'SEODescription']
                              };
                              return desiredHeaders.map((header, hIdx) => {
                                let display = '';
                                if (header === 'Namn, sv-SE') {
                                  const v = getByAliases(aliasMap[header], ['namn']);
                                  display = String(v || product.name_sv || '');
                                } else if (header === 'Beskrivning (id: DescriptionHtml), sv-SE') {
                                  const v = getByAliases(aliasMap[header], ['beskriv', 'description']);
                                  display = String(v || product.description_sv || '');
                                } else if (header === 'Kort beskrivning, sv-SE') {
                                  const v = getByAliases(aliasMap[header], ['kort', 'beskriv']);
                                  const short = String(v || product.description_sv || '');
                                  display = short.length > 120 ? `${short.substring(0, 120)}...` : short;
                                } else if (header === 'Sökmotoranpassad titel, sv-SE') {
                                  const v = getByAliases(aliasMap[header], ['seo', 'titel']);
                                  display = String(v || '');
                                } else if (header === 'Sökmotoranpassad beskrivning, sv-SE') {
                                  const v = getByAliases(aliasMap[header], ['seo', 'beskriv']);
                                  display = String(v || '');
                                } else {
                                  const v = getByAliases(aliasMap[header] || [header]);
                                  display = String(v || '');
                                }
                                if (!display) display = '-';
                                return (
                                  <td key={hIdx} className="px-3 py-2 text-sm text-gray-600">
                                    <div className="truncate" title={display}>{display}</div>
                                  </td>
                                )
                              })
                            })()
                          ) : (
                            <>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">{(item as UIString).name}</td>
                              <td className="px-3 py-2 text-sm text-gray-500">
                                <div className="space-y-1">
                                  {Object.entries((item as UIString).values).map(([locale, value]) => (
                                    <div key={locale} className="text-xs">
                                      <span className="font-medium">{locale}:</span> {value || '(tom)'}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
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
          <div className="relative">
            <ModernStepCard
              stepNumber={3}
              title={jobType === 'product_texts' ? 'Optimera & Översätt' : 'Översätt'}
              description={jobType === 'product_texts' ? 'Optimerar svenska texter och översätter till norska och danska' : 'Översätter UI-element till norska'}
              icon={jobType === 'product_texts' ? '✨' : '🌐'}
              isActive={currentStep >= 3}
              isCompleted={currentStep > 3}
              ctaText={jobType === 'product_texts' ? 'Starta optimering & översättning' : 'Starta översättning'}
              onCtaClick={async () => {
                // Start optimization and translation process
                await handleCombinedProcess()
              }}
              ctaDisabled={!actionOptimize && !actionTranslate || (actionTranslate && batchTargetLanguages.length === 0) || selectedProductIds.size === 0}
            >
            <div className="space-y-6">
              {/* Back to language selection button */}
              <div className="flex justify-start mb-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg flex items-center space-x-3 transition-colors text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Tillbaka till språkval</span>
                </button>
              </div>

              {/* Action Selection */}
              <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
                <div className="px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium">⚙️ Välj åtgärder för batchen</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Optimize card */}
                  <div className={`rounded-lg border ${actionOptimize ? 'border-blue-300' : 'border-gray-200'} p-4 bg-gray-50`}>
                    <label className="inline-flex items-center gap-2 mb-2">
                      <input type="checkbox" className="h-4 w-4" checked={actionOptimize} onChange={(e) => setActionOptimize(e.target.checked)} />
                      <span className="font-medium">Berika/optimera</span>
                    </label>
                    {actionOptimize && (
                      <>
                        <p className="text-sm text-gray-700 mb-2">Välj kolumner:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {fieldOptions.map(opt => (
                            <label key={`opt-${opt.key}`} className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={optimizeFields.has(opt.key)}
                                onChange={(e) => {
                                  setOptimizeFields(prev => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(opt.key); else next.delete(opt.key)
                                    return next
                                  })
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Translate card */}
                  <div className={`rounded-lg border ${actionTranslate ? 'border-blue-300' : 'border-gray-200'} p-4 bg-gray-50`}>
                    <label className="inline-flex items-center gap-2 mb-2">
                      <input type="checkbox" className="h-4 w-4" checked={actionTranslate} onChange={(e) => setActionTranslate(e.target.checked)} />
                      <span className="font-medium">Översätta</span>
                    </label>
                    {actionTranslate && (
                      <>
                        <p className="text-sm text-gray-700 mb-2">Välj kolumner:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {fieldOptions.map(opt => (
                            <label key={`tr-${opt.key}`} className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={translateFields.has(opt.key)}
                                onChange={(e) => {
                                  setTranslateFields(prev => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(opt.key); else next.delete(opt.key)
                                    return next
                                  })
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Language Selection */}
              {actionTranslate && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="text-md font-medium text-gray-700 mb-3">
                  Välj språk för översättning
                </h4>
                {requiredLanguages.length > 0 && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <p className="text-blue-800 font-medium">📋 Upptäckta språk i filen:</p>
                    <p className="text-blue-700">{requiredLanguages.map(lang => codeToCountry(lang).display).join(', ')}</p>
                    {requiredLanguages.includes('sv') && (
                      <p className="text-green-700 text-xs mt-1">🇸🇪 Svenska används som källspråk för översättningen</p>
                    )}
                    <p className="text-blue-600 text-xs mt-1">Andra språk är automatiskt markerade men kan avmarkeras. Välj vilka du vill översätta till.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {translationLanguages.map((langCode) => {
                    const isRequired = requiredLanguages.includes(langCode)
                    return (
                      <div key={langCode} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`batch-lang-${langCode}`}
                          checked={batchTargetLanguages.includes(langCode)}
                          onChange={() => {
                            if (batchTargetLanguages.includes(langCode)) {
                              setBatchTargetLanguages(batchTargetLanguages.filter(l => l !== langCode))
                            } else {
                              setBatchTargetLanguages([...batchTargetLanguages, langCode])
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label 
                          htmlFor={`batch-lang-${langCode}`} 
                          className="text-sm flex items-center space-x-1 cursor-pointer text-gray-700"
                        >
                          <span className="text-lg">{codeToCountry(langCode).emoji}</span>
                          <span>{codeToCountry(langCode).display}</span>
                          {isRequired && <span className="text-xs text-blue-600 font-medium">(i filen)</span>}
                        </label>
                      </div>
                    )
                  })}
                </div>
                {batchTargetLanguages.length === 0 && (
                  <p className="text-sm text-amber-600 mt-2">⚠️ Välj minst ett språk för översättning</p>
                )}
              </div>
              )}
              
              {jobType === 'product_texts' && (
                <div className="space-y-4">
                  {/* Optimize Swedish checkbox */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      id="optimize-sv"
                      checked={optimizeSv}
                      onChange={(e) => setOptimizeSv(e.target.checked)}
                      className="h-6 w-6 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="optimize-sv" className="text-lg font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                      <span className="text-2xl">✨</span>
                      <span>Optimera svenska först</span>
                    </label>
                  </div>

                  {/* Selected languages display */}
                  <div className="space-y-4">
                    <label className="text-lg font-medium text-gray-700">
                      Valda språk för översättning:
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedTargetLangs.map((langCode) => (
                        <div key={langCode} className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl">{codeToCountry(langCode).emoji}</span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-lg text-blue-800">{codeToCountry(langCode).display}</span>
                              <span className="text-sm text-blue-600">({langCode.toUpperCase()})</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedTargetLangs.length === 0 && (
                      <p className="text-sm text-amber-600">⚠️ Inga språk valda för översättning</p>
                    )}
                  </div>

                </div>
              )}

              {jobType === 'ui_strings' && (
                <div className="space-y-4">
                  {/* Source and target languages display for UI strings */}
                  <div className="space-y-4">
                    {/* Source language */}
                    <div className="space-y-2">
                      <label className="text-lg font-medium text-gray-700">
                        Källspråk:
                      </label>
                      <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-3">
                          <span className="text-3xl">🇸🇪</span>
                          <div className="flex flex-col">
                            <span className="font-semibold text-lg text-green-800">Svenska</span>
                            <span className="text-sm text-green-600">(SV) - Används som grund för översättning</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Target languages */}
                    <div className="space-y-2">
                      <label className="text-lg font-medium text-gray-700">
                        Målsspråk för översättning:
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedTargetLangs.map((langCode) => (
                          <div key={langCode} className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center space-x-3">
                              <span className="text-3xl">{codeToCountry(langCode).emoji}</span>
                              <div className="flex flex-col">
                                <span className="font-semibold text-lg text-blue-800">{codeToCountry(langCode).display}</span>
                                <span className="text-sm text-blue-600">({langCode.toUpperCase()})</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedTargetLangs.length === 0 && (
                        <p className="text-sm text-amber-600">⚠️ Inga målsspråk valda för översättning</p>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {jobType === 'brands' && (
                <div className="space-y-4">
                  {/* Available columns from Excel */}
                  <div className="space-y-4">
                    <label className="text-lg font-medium text-gray-700">
                      Tillgängliga kolumner från Excel-fil:
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {brandsHeaders.map((header, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                          <span className="text-sm font-mono text-gray-600">{header}</span>
                        </div>
                      ))}
                    </div>
                    {brandsHeaders.length === 0 && (
                      <p className="text-sm text-amber-600">⚠️ Inga kolumner hittades i Excel-filen</p>
                    )}
                  </div>

                  {/* Selected languages display */}
                  <div className="space-y-4">
                    <label className="text-lg font-medium text-gray-700">
                      Valda språk för översättning:
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedTargetLangs.map((langCode) => (
                        <div key={langCode} className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl">{codeToCountry(langCode).emoji}</span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-lg text-blue-800">{codeToCountry(langCode).display}</span>
                              <span className="text-sm text-blue-600">({langCode.toUpperCase()})</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedTargetLangs.length === 0 && (
                      <p className="text-sm text-amber-600">⚠️ Inga språk valda för översättning</p>
                    )}
                  </div>

                </div>
              )}

              {/* Product Selection Table - Same as step 2 */}
              {(() => {
                const shouldShow = jobType === 'product_texts' && currentStep === 3 && batchId
                console.log('[DEBUG] Step 3 table visibility check:', {
                  jobType,
                  currentStep,
                  batchId,
                  shouldShow,
                  selectedBatchProducts: selectedBatch?.products?.length || 0,
                  parsedProductsLength: parsedProducts.length
                })
                return shouldShow
              })() && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <div className="px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium mb-4">
                      📦 Välj produkter att optimera/översätta ({selectedProductIds.size} av {(selectedBatch?.products || parsedProducts).length} valda)
                    </div>
                    
                    {/* Product table - Same structure as step 2 */}
                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.size === (selectedBatch?.products || parsedProducts).length && (selectedBatch?.products || parsedProducts).length > 0}
                                onChange={() => {
                                  const products = selectedBatch?.products || parsedProducts
                                  if (selectedProductIds.size === products.length) {
                                    setSelectedProductIds(new Set())
                                  } else {
                                    setSelectedProductIds(new Set(products.map((p: Product) => p.id)))
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ARTIKELNUMMER</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VARIANTAV</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAMN, SV-SE</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KORT BESKRIVNING, SV-SE</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BESKRIVNING (ID: DESCRIPTIONHTML), SV-SE</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SÖKMOTORANPASSAD TITEL, SV-SE</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SÖKMOTORANPASSAD BESKRIVNING, SV-SE</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(selectedBatch?.products || parsedProducts).slice(0, visibleRows).map((product: Product, index: number) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-2 py-1 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedProductIds.has(product.id)}
                                  onChange={() => {
                                    setSelectedProductIds(prev => {
                                      const next = new Set(prev)
                                      if (next.has(product.id)) {
                                        next.delete(product.id)
                                      } else {
                                        next.add(product.id)
                                      }
                                      return next
                                    })
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              {(() => {
                                try {
                                  const rawData = typeof product.raw_data === 'string' ? JSON.parse(product.raw_data) : (product.raw_data || {})
                                  // Normalize helper for flexible header matching (same as step 2)
                                  const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9åäöæøœ]+/g, '')
                                  const toPlainString = (v: unknown): string => {
                                    if (v === null || v === undefined) return ''
                                    if (typeof v === 'string') return v
                                    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
                                    try { return JSON.stringify(v) } catch { return String(v) }
                                  }
                                  const normalizedMap: Record<string, string> = {}
                                  for (const [k, v] of Object.entries(rawData)) {
                                    normalizedMap[normalizeKey(String(k))] = toPlainString(v)
                                  }
                                  const getByAliases = (aliases: string[]): string => {
                                    for (const a of aliases) {
                                      const norm = normalizeKey(a)
                                      if (normalizedMap[norm]) return normalizedMap[norm]
                                    }
                                    return ''
                                  }
                                  const aliasMap: Record<string, string[]> = {
                                    'Artikelnummer': ['Artikelnummer', 'Artikel nr', 'Art nr', 'Artikelnr', 'ArtNr', 'SKU', 'Artikelnummer*'],
                                    'VariantAv': ['VariantAv', 'Variant Av', 'Variant-Av', 'VariantOf', 'Parent', 'Parent SKU'],
                                    'Beskrivning (id: DescriptionHtml), sv-SE': [
                                      'Beskrivning (id: DescriptionHtml), sv-SE',
                                      'Beskrivning, sv-SE',
                                      'Beskrivning',
                                      'Description',
                                      'Long description',
                                      'DescriptionHtml'
                                    ],
                                    'Sökmotoranpassad titel, sv-SE': [
                                      'Sökmotoranpassad titel, sv-SE',
                                      'Sökmotoranpassad titel',
                                      'SEO title',
                                      'Title SEO'
                                    ],
                                    'Sökmotoranpassad beskrivning, sv-SE': [
                                      'Sökmotoranpassad beskrivning, sv-SE',
                                      'Sökmotoranpassad beskrivning',
                                      'SEO description',
                                      'Meta description'
                                    ],
                                  }
                                  const artikelnummer = getByAliases(aliasMap['Artikelnummer']) || '-'
                                  const variantAv = getByAliases(aliasMap['VariantAv']) || '-'
                                  const longDesc = getByAliases(aliasMap['Beskrivning (id: DescriptionHtml), sv-SE']) || '-'
                                  const seoTitle = getByAliases(aliasMap['Sökmotoranpassad titel, sv-SE']) || '-'
                                  const seoDesc = getByAliases(aliasMap['Sökmotoranpassad beskrivning, sv-SE']) || '-'

                                  return (
                                    <>
                                      <td className="px-2 py-1 text-sm text-gray-900">{artikelnummer || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{variantAv || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{product.name_sv || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{product.description_sv || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{longDesc || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{seoTitle || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{seoDesc || '-'}</td>
                                    </>
                                  )
                                } catch {
                                  return (
                                    <>
                                      <td className="px-2 py-1 text-sm text-gray-900">-</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">-</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{product.name_sv || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">{product.description_sv || '-'}</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">-</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">-</td>
                                      <td className="px-2 py-1 text-sm text-gray-900">-</td>
                                    </>
                                  )
                                }
                              })()}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Show more/less button */}
                    {(selectedBatch?.products || parsedProducts).length > visibleRows && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => setVisibleRows(visibleRows === 200 ? (selectedBatch?.products || parsedProducts).length : 200)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {visibleRows === 200 ? `Visa alla ${(selectedBatch?.products || parsedProducts).length} produkter` : 'Visa färre'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress bars */}
              {phase === 'optimizing' && progress && (
                <ProgressBar
                  percent={progress.percent || 0}
                  done={progress.done || 0}
                  total={progress.total || 0}
                  counts={progress.counts || { pending: 0, optimizing: 0, optimized: 0, translating: 0, completed: 0, error: 0 }}
                  startTime={optimizationStartTime}
                  jobType={jobType}
                  phase="optimizing"
                />
              )}

              {phase === 'translating' && progress && (
                <ProgressBar
                  percent={progress.percent || 0}
                  done={progress.done || 0}
                  total={progress.total || 0}
                  counts={progress.counts || { pending: 0, optimizing: 0, optimized: 0, translating: 0, completed: 0, error: 0 }}
                  startTime={translationStartTime}
                  jobType={jobType}
                  phase="translating"
                />
              )}
              
              {/* Alerts */}
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
                  <div className="flex flex-wrap gap-2 mb-8">
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
                      onClick={handleCombinedProcess}
                      disabled={!batchId || selectedProductIds.size === 0 || (!optimizeSv && selectedTargetLangs.length === 0)}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      🚀 Kör översättning
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={!batchId}
                      className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      📊 Exportera Excel
                    </button>
                    {selectedProductIds.size === 0 && (
                      <span className="text-sm text-gray-500 flex items-center">
                        Välj produkter att bearbeta
                      </span>
                    )}
                    {selectedProductIds.size > 0 && !optimizeSv && selectedTargetLangs.length === 0 && (
                      <span className="text-sm text-gray-500 flex items-center">
                        Välj "Optimera svenska först" eller skapa en batch med språk valda
                      </span>
                    )}
                  </div>
                  
                  {/* Produktlista eller UI-element lista */}
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                            <input
                              type="checkbox"
                              checked={selectedIds.size === (jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length) && (jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length) > 0}
                              onChange={selectedIds.size === (jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length) ? handleDeselectAll : handleSelectAll}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          {jobType === 'product_texts' ? (
                            <>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRODUKTNAMN</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BESKRIVNING (SV)</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OPTIMERAD TEXT (SV)</th>
                              {selectedTargetLangs.map((langCode) => (
                                <th key={langCode} className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  OPTIMERAD TEXT ({langCode.toUpperCase()})
                                </th>
                              ))}
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">STATUS</th>
                            </>
                          ) : jobType === 'brands' ? (
                            <>
                              {brandsHeaders.map((header, index) => (
                                <th key={index} className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {header}
                                </th>
                              ))}
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">STATUS</th>
                            </>
                          ) : (
                            <>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAMN</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KÄLLA (SV-SE)</th>
                              {/* Show only selected target languages */}
                              {selectedTargetLangs.map((langCode) => {
                                const localeMap: Record<string, string> = {
                                  'da': 'da-DK',
                                  'nb': 'nb-NO',
                                  'no': 'no-NO',
                                  'en': 'en-US',
                                  'de': 'de-DE',
                                  'fr': 'fr-FR',
                                  'es': 'es-ES',
                                  'it': 'it-IT',
                                  'pt': 'pt-PT',
                                  'nl': 'nl-NL',
                                  'pl': 'pl-PL',
                                  'ru': 'ru-RU',
                                  'fi': 'fi-FI',
                                  'sv': 'sv-SE'
                                };
                                const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`;
                                return (
                                  <th key={locale} className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {locale}
                                  </th>
                                );
                              })}
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
                        ) : jobType === 'ui_strings' ? (
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
                              <td className="px-2 py-1 text-xs text-gray-600">
                                <div className="truncate" title={uiItem.values['sv-SE'] || ''}>
                                  {uiItem.values['sv-SE'] || '(tom)'}
                                </div>
                              </td>
                              {/* Show only selected target languages */}
                              {selectedTargetLangs.map((langCode) => {
                                const localeMap: Record<string, string> = {
                                  'da': 'da-DK',
                                  'nb': 'nb-NO',
                                  'no': 'no-NO',
                                  'en': 'en-US',
                                  'de': 'de-DE',
                                  'fr': 'fr-FR',
                                  'es': 'es-ES',
                                  'it': 'it-IT',
                                  'pt': 'pt-PT',
                                  'nl': 'nl-NL',
                                  'pl': 'pl-PL',
                                  'ru': 'ru-RU',
                                  'fi': 'fi-FI',
                                  'sv': 'sv-SE'
                                };
                                const locale = localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`;
                                const value = uiItem.values[locale] || '';
                                return (
                                  <td key={locale} className="px-2 py-1 text-xs text-gray-500">
                                    <div className="truncate" title={value}>
                                      {value || '(tom)'}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1 text-xs text-gray-700">
                                {uiItem.status || 'pending'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          parsedBrands.slice(0, visibleRows).map((brand, index) => {
                            // Parse raw_data to get cell values
                            let rawData: Record<string, any> = {};
                            try {
                              rawData = brand.raw_data ? JSON.parse(brand.raw_data) : {};
                            } catch (error) {
                              console.warn('Failed to parse brand raw_data:', error);
                            }

                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-2 py-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(index)}
                                    onChange={() => handleProductToggle(index)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                {brandsHeaders.map((header, headerIndex) => {
                                  const cellValue = rawData[header] || '';
                                  const displayValue = String(cellValue).trim();
                                  
                                  return (
                                    <td key={headerIndex} className="px-2 py-1 text-xs text-gray-500">
                                      {displayValue ? (
                                        <div className="truncate" title={displayValue}>
                                          {displayValue.length > 40 
                                            ? `${displayValue.substring(0, 40)}...` 
                                            : displayValue}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1 text-xs text-gray-700">
                                  {brand.status || 'pending'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Visa fler-knapp */}
                  {visibleRows < (jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length) && (
                    <div className="text-center mt-4">
                      <button
                        onClick={handleShowMore}
                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                      >
                        Visa fler ({Math.min(200, (jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length) - visibleRows)} till)
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        Visar {Math.min(visibleRows, jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length)} av {jobType === 'product_texts' ? parsedProducts.length : jobType === 'ui_strings' ? parsedUIStrings.length : parsedBrands.length} {jobType === 'product_texts' ? 'produkter' : jobType === 'ui_strings' ? 'UI-element' : 'varumärken'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            </ModernStepCard>
          </div>
        )}

        {/* Delete batch button - below the widget */}
        {currentStep === 3 && selectedBatch && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                openDeleteModal('batch', selectedBatch.id, selectedBatch.filename, selectedBatch.total_products);
              }}
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md flex items-center justify-center shadow-lg"
              title="Radera batch"
              style={{ backgroundColor: '#dc2626', width: '40px', height: '40px' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
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
                {deleteTarget.type === 'upload' ? (
                  <>
                    Är du säker på att du vill radera uploaden "{deleteTarget.name}"?
                    Detta kommer också att radera alla relaterade batchar och produkter/UI-element.
                  </>
                ) : (
                  <>
                    Är du säker på att du vill radera batchen "{deleteTarget.name}" ({deleteTarget.count} {jobType === 'product_texts' ? 'produkter' : 'UI-element'})?
                    Detta kommer att ta bort batchen från listan.
                  </>
                )}
              </p>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={deleteTarget.type === 'upload' ? handleDeleteUpload : handleDeleteBatch}
                  style={{
                    background: deleteTarget.type === 'upload' ? '#1d40b0' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: '0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = deleteTarget.type === 'upload' ? '#1e3a8a' : '#b91c1c'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = deleteTarget.type === 'upload' ? '#1d40b0' : '#dc2626'
                  }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
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
