import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optimizeSv, translateTo } from '@/lib/llm/adapter'
import { cleanTranslationFormat } from '@/lib/format-guard'
import { getOpenAIConfig } from '@/lib/openai-config'

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params
    
    // Parse request body
    const body = await request.json()
    const { 
      indices = [], 
      optimizeSv: shouldOptimize = false, 
      targetLangs = [],
      clientPromptSettings = {}
    } = body

    if (!Array.isArray(targetLangs)) {
      return NextResponse.json(
        { error: 'Target languages must be an array' },
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
    
    console.log('[PROCESS] Received body:', JSON.stringify(body, null, 2));
    console.log('[PROCESS] Using model:', jobConfig.model);

    // Verify batch exists
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: { 
        products: {
          select: {
            id: true,
            name_sv: true,
            description_sv: true,
            attributes: true,
            tone_hint: true,
            raw_data: true,
            status: true,
            optimized_sv: true,
            translations: true
          }
        },
        upload: true
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    console.log(`[PROCESS] Batch found: ${batch.id}, job_type: ${batch.job_type}`);

    // Support both product_texts and ui_strings
    if (batch.job_type !== 'product_texts' && batch.job_type !== 'ui_strings') {
      return NextResponse.json(
        { error: 'Unsupported job type' },
        { status: 400 }
      )
    }

    // Update batch status
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'running' }
    })

    let completedJobs = 0;
    let totalJobs = 0;
    let itemsToProcess: any[] = [];

    if (batch.job_type === 'product_texts') {
      // Get products to process
      itemsToProcess = indices.length > 0 
        ? indices.map(index => batch.products[index]).filter(Boolean)
        : batch.products;

      if (itemsToProcess.length === 0) {
        return NextResponse.json(
          { error: 'No products selected for processing' },
          { status: 400 }
        )
      }

      console.log(`[PROCESS] Processing ${itemsToProcess.length} products`);
      console.log(`[PROCESS] Optimize SV: ${shouldOptimize}`);
      console.log(`[PROCESS] Target languages: ${targetLangs.length > 0 ? targetLangs.join(', ') : 'none (optimization only)'}`);

      // Calculate total jobs for progress tracking
      totalJobs = itemsToProcess.length * (shouldOptimize ? 1 : 0) + 
                  itemsToProcess.length * targetLangs.length;

      console.log(`[PROCESS] Total jobs to complete: ${totalJobs}`);

      // Process each product
      for (let i = 0; i < itemsToProcess.length; i++) {
        const product = itemsToProcess[i];
        let sourceText = product.description_sv;

        try {
          console.log(`[PROCESS] Processing product: ${product.name_sv}`);

          // Step 1: Optimize Swedish if requested
          if (shouldOptimize) {
            console.log(`[PROCESS] Optimizing Swedish for product: ${product.name_sv}`);
            
            // Set status to optimizing
            await prisma.product.update({
              where: { id: product.id },
              data: { status: 'optimizing' }
            });

            // Use LLM adapter for optimization
            const optimizedText = await optimizeSv({
              nameSv: product.name_sv,
              descriptionSv: product.description_sv,
              attributes: product.attributes,
              toneHint: product.tone_hint || undefined,
              rawData: product.raw_data || undefined
            }, {
              ...clientPromptSettings.optimize,
              model: jobConfig.model,
              system: jobConfig.promptOptimizeSv,
              uploadMeta: batch.upload?.meta || undefined,
              settingsTokens: openaiConfig.exampleProductImportTokens || undefined
            });

            // Update product with optimized text
            await prisma.product.update({
              where: { id: product.id },
              data: {
                optimized_sv: optimizedText,
                status: 'optimized'
              }
            });

            sourceText = optimizedText;
            completedJobs++;
            console.log(`[PROCESS] Optimization completed for ${product.name_sv}`);
          }

          // Step 2: Translate to all target languages (if any selected)
          if (targetLangs.length > 0) {
            console.log(`[PROCESS] Translating product: ${product.name_sv} to ${targetLangs.join(', ')}`);
            
            // Set status to translating
            await prisma.product.update({
              where: { id: product.id },
              data: { status: 'translating' }
            });

            // Parse existing translations or create new object
            let translations: Record<string, string> = {};
            if (product.translations) {
              try {
                translations = JSON.parse(product.translations);
              } catch (error) {
                console.warn('Failed to parse existing translations:', error);
                translations = {};
              }
            }

            // Translate to each target language
            for (const language of targetLangs) {
            try {
              console.log(`[PROCESS] Translating ${product.name_sv} to ${language}`);
              
              // Use LLM adapter for translation
              const translatedText = await translateTo({
                text: sourceText,
                target: language
              }, {
                model: jobConfig.model,
                sourceLang: 'sv'
              });

              // Apply format guard to clean up any extra # characters
              const cleanedText = cleanTranslationFormat(sourceText, translatedText);
              
              // Add translation to the translations object
              translations[language] = cleanedText;
              
              completedJobs++;
              console.log(`[PROCESS] Translation to ${language} completed for ${product.name_sv}`);
            } catch (error) {
              console.error(`[PROCESS] Error translating ${product.name_sv} to ${language}:`, error);
              // Continue with other languages even if one fails
            }
          }

            // Update product with all translations
            const updateData: any = {
              translations: JSON.stringify(translations),
              status: 'completed'
            };

            // Also update legacy fields for backward compatibility
            for (const language of targetLangs) {
              if (translations[language]) {
                const fieldName = `translated_${language}`;
                updateData[fieldName] = translations[language];
              }
            }

            await prisma.product.update({
              where: { id: product.id },
              data: updateData
            });

            console.log(`[PROCESS] Product ${product.name_sv} processing completed`);
          } else {
            // No translation needed, just mark as completed if optimization was done
            if (shouldOptimize) {
              await prisma.product.update({
                where: { id: product.id },
                data: { status: 'completed' }
              });
            }
            console.log(`[PROCESS] Product ${product.name_sv} optimization completed (no translation)`);
          }

        } catch (error) {
          console.error(`[PROCESS] Error processing product ${product.name_sv}:`, error);
          await prisma.product.update({
            where: { id: product.id },
            data: {
              status: 'error',
              error_message: error instanceof Error ? error.message : 'Processing failed'
            }
          });
          
          // Still count as completed for progress tracking
          completedJobs += shouldOptimize ? 1 : 0;
          completedJobs += targetLangs.length;
        }
      }
    } else if (batch.job_type === 'ui_strings') {
      // Get UI items to process
      const batchWithUIItems = await prisma.productBatch.findUnique({
        where: { id: batchId },
        include: { ui_items: true }
      });

      if (!batchWithUIItems) {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        )
      }

      itemsToProcess = indices.length > 0 
        ? indices.map(index => batchWithUIItems.ui_items[index]).filter(Boolean)
        : batchWithUIItems.ui_items;

      if (itemsToProcess.length === 0) {
        return NextResponse.json(
          { error: 'No UI items selected for processing' },
          { status: 400 }
        )
      }

      console.log(`[PROCESS] Processing ${itemsToProcess.length} UI items`);
      console.log(`[PROCESS] Optimize SV: ${shouldOptimize} (not applicable for UI items)`);
      console.log(`[PROCESS] Target languages: ${targetLangs.length > 0 ? targetLangs.join(', ') : 'none'}`);

      // For UI items, we only support translation (no optimization)
      if (shouldOptimize) {
        return NextResponse.json(
          { error: 'Optimization is not supported for UI elements' },
          { status: 400 }
        )
      }

      if (targetLangs.length === 0) {
        return NextResponse.json(
          { error: 'At least one target language must be selected for UI elements' },
          { status: 400 }
        )
      }

      // Calculate total jobs for progress tracking
      totalJobs = itemsToProcess.length * targetLangs.length;

      console.log(`[PROCESS] Total jobs to complete: ${totalJobs}`);

      // Process each UI item
      for (let i = 0; i < itemsToProcess.length; i++) {
        const uiItem = itemsToProcess[i];

        try {
          console.log(`[PROCESS] Processing UI item: ${uiItem.name}`);

          // Get current values
          const currentValues = JSON.parse(uiItem.values);
          
          // Find source text (prefer sv-SE, fallback to en-US)
          const sourceText = currentValues['sv-SE'] || currentValues['en-US'] || '';
          
          console.log(`[PROCESS] Source text for ${uiItem.name}: "${sourceText}"`);
          
          if (sourceText && sourceText.trim()) {
            // Set status to processing
            await prisma.uIItem.update({
              where: { id: uiItem.id },
              data: { status: 'processing' }
            });
            
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
            };
            
            // Start with current values and build up all translations
            let updatedValues = { ...currentValues };
            
            // Translate to each target language
            for (const language of targetLangs) {
              try {
                console.log(`[PROCESS] Translating ${uiItem.name} to ${language}`);
                
                // Use LLM adapter for translation
                const translatedText = await translateTo({
                  text: sourceText,
                  target: language
                }, {
                  model: jobConfig.model,
                  sourceLang: 'sv'
                });
                
                const locale = localeMap[language] || `${language}-${language.toUpperCase()}`;
                updatedValues[locale] = translatedText;
                
                completedJobs++;
                console.log(`[PROCESS] Translation to ${language} completed for ${uiItem.name}: ${translatedText}`);
              } catch (error) {
                console.error(`[PROCESS] Error translating ${uiItem.name} to ${language}:`, error);
                // Still count as completed for progress tracking
                completedJobs++;
              }
            }
            
            // Update UI item with all translations at once
            await prisma.uIItem.update({
              where: { id: uiItem.id },
              data: { 
                values: JSON.stringify(updatedValues),
                status: 'completed'
              }
            });
          } else {
            console.log(`[PROCESS] Skipping UI item ${uiItem.name} - no source text`);
            await prisma.uIItem.update({
              where: { id: uiItem.id },
              data: { status: 'completed' }
            });
            // Count as completed even if skipped
            completedJobs += targetLangs.length;
          }

        } catch (error) {
          console.error(`[PROCESS] Error processing UI item ${uiItem.name}:`, error);
          await prisma.uIItem.update({
            where: { id: uiItem.id },
            data: {
              status: 'error',
              error_message: error instanceof Error ? error.message : 'Processing failed'
            }
          });
          
          // Still count as completed for progress tracking
          completedJobs += targetLangs.length;
        }
      }
    }

    // Mark batch as completed
    await prisma.productBatch.update({
      where: { id: batchId },
      data: { status: 'completed' }
    });

    console.log(`[PROCESS] Batch processing completed: ${completedJobs}/${totalJobs} jobs`);

    return NextResponse.json({
      message: 'Combined processing completed',
      batchId,
      itemsCount: itemsToProcess.length,
      optimizeSv: shouldOptimize,
      targetLangs,
      completedJobs,
      totalJobs
    });

  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
