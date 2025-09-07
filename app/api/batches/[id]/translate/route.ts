import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { translateQueue } from '@/lib/queue'
import { translateTo } from '@/lib/llm/adapter'
import { cleanTranslationFormat } from '@/lib/format-guard'
import { getOpenAIConfig } from '@/lib/openai-config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params
    const { languages, selectedProductIds, clientPromptSettings } = await request.json()

    if (!languages || !Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json(
        { error: 'Languages array is required' },
        { status: 400 }
      )
    }

    // Get OpenAI settings snapshot for this job
    const openaiConfig = await getOpenAIConfig()
    const jobConfig = {
      model: openaiConfig.model,
      promptOptimizeSv: openaiConfig.promptOptimizeSv,
      promptTranslateDirect: openaiConfig.promptTranslateDirect
    }
    
    console.log('[TRANSLATE] Using model:', jobConfig.model);

    // Verify batch exists and has optimized products or UI items
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: { 
        products: true,
        ui_items: true
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    let productsToTranslate: any[] = []
    
    if (batch.job_type === 'product_texts') {
      // Filter products that have optimized_sv and are selected
      productsToTranslate = batch.products.filter(product => {
        const hasOptimizedSv = product.optimized_sv && product.optimized_sv.trim()
        const isSelected = !selectedProductIds || selectedProductIds.length === 0 || 
                          selectedProductIds.includes(product.id)
        return hasOptimizedSv && isSelected
      })

      if (productsToTranslate.length === 0) {
        return NextResponse.json(
          { error: 'No optimized products found for translation' },
          { status: 400 }
        )
      }

      console.log(`[TRANSLATE] Starting translation for ${productsToTranslate.length} products`)
    } else {
      // For UI elements, we need to translate the empty values
      const uiItemsToTranslate = batch.ui_items.filter(item => {
        const isSelected = !selectedProductIds || selectedProductIds.length === 0 || 
                          selectedProductIds.includes(item.id)
        return isSelected
      })

      if (uiItemsToTranslate.length === 0) {
        return NextResponse.json(
          { error: 'No UI items found for translation' },
          { status: 400 }
        )
      }

      console.log(`[TRANSLATE] Starting translation for ${uiItemsToTranslate.length} UI items`)
      
      // Update batch status
      await prisma.productBatch.update({
        where: { id: batchId },
        data: { status: 'running' }
      })

      // Return jobId immediately and process asynchronously
      const jobId = `ui-translate-${batchId}-${Date.now()}`
      
      // Start async processing
      setTimeout(async () => {
        // Process each UI item directly with progress tracking
        for (let i = 0; i < uiItemsToTranslate.length; i++) {
          const uiItem = uiItemsToTranslate[i]
        
          for (const language of languages) {
            try {
              console.log(`[TRANSLATE] Processing UI item: ${uiItem.name} -> ${language}`)
              
              // Set status to processing
              await prisma.uIItem.update({
                where: { id: uiItem.id },
                data: { status: 'processing' }
              })
              
              // Get current values
              const currentValues = JSON.parse(uiItem.values)
              
              // Find source text (prefer sv-SE, fallback to en-US)
              const sourceText = currentValues['sv-SE'] || currentValues['en-US'] || ''
              
              console.log(`[TRANSLATE] Source text for ${uiItem.name}: "${sourceText}"`)
              
              if (sourceText && sourceText.trim()) {
                // Translate using LLM
                console.log(`[TRANSLATE] Calling translateTo with: "${sourceText}", language: ${language}`)
                
                let translatedText: string
                try {
                  translatedText = await translateTo({
                    text: sourceText,
                    target: language
                  }, {
                    model: jobConfig.model
                  })
                  console.log(`[TRANSLATE] translateTo returned: "${translatedText}"`)
                } catch (translateError) {
                  console.error(`[TRANSLATE] Error in translateTo:`, translateError)
                  throw translateError
                }
                
                // Update values with translation
                // Map language codes to locale format
                const localeMap: Record<string, string> = {
                  'da': 'da-DK',
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
                }
                
                const locale = localeMap[language] || `${language}-${language.toUpperCase()}`
                const updatedValues = {
                  ...currentValues,
                  [locale]: translatedText
                }
                
                // Update UI item
                await prisma.uIItem.update({
                  where: { id: uiItem.id },
                  data: { 
                    values: JSON.stringify(updatedValues),
                    status: 'completed'
                  }
                })
                
                console.log(`[TRANSLATE] Completed UI item: ${uiItem.name} -> ${language}: ${translatedText}`)
              } else {
                console.log(`[TRANSLATE] Skipping UI item ${uiItem.name} - no source text`)
                await prisma.uIItem.update({
                  where: { id: uiItem.id },
                  data: { status: 'completed' }
                })
              }
              
              // Add small delay to allow progress events to be sent
              await new Promise(resolve => setTimeout(resolve, 500))
            } catch (error) {
              console.error(`[TRANSLATE] Error processing UI item ${uiItem.name}:`, error)
              await prisma.uIItem.update({
                where: { id: uiItem.id },
                data: { 
                  status: 'error',
                  error_message: error instanceof Error ? error.message : 'Unknown error'
                }
              })
            }
          }
        }

        // Mark batch as completed
        await prisma.productBatch.update({
          where: { id: batchId },
          data: { status: 'completed' }
        })
      }, 0) // Execute immediately but asynchronously

      // Return jobId for progress tracking (same pattern as product translation)
      return NextResponse.json({ 
        message: 'UI elements translation started',
        jobId: jobId,
        total: uiItemsToTranslate.length
      })
    }
    console.log(`[TRANSLATE] Languages:`, languages)

    // Update batch status
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'running' }
    })

    // Process each product directly (like optimize does) - but return immediately for progress tracking
    // Start async processing
    setTimeout(async () => {
      for (let i = 0; i < productsToTranslate.length; i++) {
        const product = productsToTranslate[i]
        
        for (const language of languages) {
          try {
            console.log(`[TRANSLATE] Processing product: ${product.name_sv} -> ${language}`)
            
            // Set status to translating
            await prisma.product.update({
              where: { id: product.id },
              data: { status: 'translating' }
            })
            
            // Use LLM adapter for translation with server settings snapshot
            const translatedText = await translateTo({
              text: product.optimized_sv!,
              target: language
            }, {
              model: jobConfig.model
            })
            
            // Apply format guard to clean up any extra # characters
            const cleanedText = cleanTranslationFormat(product.optimized_sv!, translatedText)
            
            console.log(`[TRANSLATE] Product ${product.name_sv} translated to ${language} successfully`)
            
            // Update product with translated text using new translations field
            const updateData: any = {}
            
            // Parse existing translations or create new object
            let translations: Record<string, string> = {}
            if (product.translations) {
              try {
                translations = JSON.parse(product.translations)
              } catch (error) {
                console.warn('Failed to parse existing translations:', error)
                translations = {}
              }
            }
            
            // Add new translation
            translations[language] = cleanedText
            updateData.translations = JSON.stringify(translations)
            
            // Also update legacy fields for backward compatibility
            if (language === 'da') {
              updateData.translated_da = cleanedText
            } else if (language === 'no') {
              updateData.translated_no = cleanedText
            } else if (language === 'en') {
              updateData.translated_en = cleanedText
            } else if (language === 'de') {
              updateData.translated_de = cleanedText
            } else if (language === 'fr') {
              updateData.translated_fr = cleanedText
            } else if (language === 'es') {
              updateData.translated_es = cleanedText
            } else if (language === 'it') {
              updateData.translated_it = cleanedText
            } else if (language === 'pt') {
              updateData.translated_pt = cleanedText
            } else if (language === 'nl') {
              updateData.translated_nl = cleanedText
            } else if (language === 'pl') {
              updateData.translated_pl = cleanedText
            } else if (language === 'ru') {
              updateData.translated_ru = cleanedText
            } else if (language === 'fi') {
              updateData.translated_fi = cleanedText
            }
            
            // Set status based on translation progress
            const translatedLanguages = Object.keys(translations).filter(lang => translations[lang] && translations[lang].trim())
            const hasTranslations = translatedLanguages.length > 0
            
            if (hasTranslations) {
              // Has translations - mark as completed
              updateData.status = 'completed'
            } else {
              // No translations yet - should not happen but keep as optimized
              updateData.status = 'optimized'
            }
            
            await prisma.product.update({
              where: { id: product.id },
              data: updateData
            })
            
          } catch (error) {
            console.error(`[TRANSLATE] Error translating product ${product.name_sv} to ${language}:`, error)
            await prisma.product.update({
              where: { id: product.id },
              data: {
                status: 'error',
                error_message: `Translation to ${language} failed`
              }
            })
          }
        }
      }
    }, 100)

    // Return jobId immediately for progress tracking (same pattern as UI elements)
    const jobId = `product-translate-${batchId}-${Date.now()}`
    
    return NextResponse.json({
      message: 'Translation started',
      jobId: jobId,
      batchId,
      productsCount: productsToTranslate.length,
      languages
    })
  } catch (error) {
    console.error('Translate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
