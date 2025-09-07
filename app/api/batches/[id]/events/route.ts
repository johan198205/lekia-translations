import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params
  const { searchParams } = new URL(request.url)
  const selectedIndicesParam = searchParams.get('selectedIndices')
  const selectedIndices = selectedIndicesParam ? selectedIndicesParam.split(',').map(Number) : []

  // Set up SSE headers
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Declare heartbeatInterval at the top level
      let heartbeatInterval: NodeJS.Timeout | null = null
      
      try {
        // Send initial connection message
        controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

        // Send initial progress snapshot from DB
        try {
          const batch = await prisma.productBatch.findUnique({
            where: { id: batchId },
            include: {
              products: {
                select: {
                  status: true
                }
              },
              ui_items: {
                select: {
                  status: true
                }
              }
            }
          })

          if (!batch) {
            controller.enqueue(encoder.encode('data: {"type":"error","message":"Batch not found"}\n\n'))
            controller.close()
            return
          }

          // Calculate initial progress - for products or UI items
          let itemsToCheck: any[] = []
          let total = 0
          let pending = 0
          let optimizing = 0
          let optimized = 0
          let translating = 0
          let completed = 0
          let error = 0

          if (batch.job_type === 'product_texts') {
            itemsToCheck = selectedIndices.length > 0 
              ? selectedIndices.map(index => batch.products[index]).filter(Boolean)
              : batch.products;
            
            total = itemsToCheck.length
            pending = itemsToCheck.filter(p => p.status === 'pending').length
            optimizing = itemsToCheck.filter(p => p.status === 'optimizing').length
            optimized = itemsToCheck.filter(p => p.status === 'optimized').length
            translating = itemsToCheck.filter(p => p.status === 'translating').length
            completed = itemsToCheck.filter(p => p.status === 'completed').length
            error = itemsToCheck.filter(p => p.status === 'error').length
          } else {
            itemsToCheck = selectedIndices.length > 0 
              ? selectedIndices.map(index => batch.ui_items[index]).filter(Boolean)
              : batch.ui_items;
            
            total = itemsToCheck.length
            pending = itemsToCheck.filter(p => p.status === 'pending').length
            optimizing = itemsToCheck.filter(p => p.status === 'processing').length // UI items use 'processing' instead of 'optimizing'
            optimized = 0 // UI items don't have optimized status
            translating = 0 // UI items don't have translating status
            completed = itemsToCheck.filter(p => p.status === 'completed').length
            error = itemsToCheck.filter(p => p.status === 'error').length
          }

          const processedItems = total - pending
          const percent = total > 0 ? Math.round((processedItems / total) * 100) : 0

          const initialProgress = {
            type: 'progress',
            data: {
              done: processedItems,
              total,
              percent,
              counts: {
                pending,
                optimizing,
                optimized,
                translating,
                completed,
                error
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialProgress)}\n\n`))
        } catch (error) {
          console.error('Failed to get initial progress:', error)
        }


        // Poll database for progress updates every 2 seconds
        const progressInterval = setInterval(async () => {
          try {
            const batch = await prisma.productBatch.findUnique({
              where: { id: batchId },
              include: {
                products: {
                  select: {
                    status: true,
                    translated_da: true,
                    translated_no: true,
                    translated_en: true,
                    translated_de: true,
                    translated_fr: true,
                    translated_es: true,
                    translated_it: true,
                    translated_pt: true,
                    translated_nl: true,
                    translated_pl: true,
                    translated_ru: true,
                    translated_fi: true
                  }
                },
                ui_items: {
                  select: {
                    status: true
                  }
                }
              }
            })

            if (!batch) {
              controller.enqueue(encoder.encode('data: {"type":"error","message":"Batch not found"}\n\n'))
              clearInterval(progressInterval)
              controller.close()
              return
            }

            // Calculate progress - for products or UI items
            let itemsToCheck: any[] = []
            let total = 0
            let pending = 0
            let optimizing = 0
            let optimized = 0
            let translating = 0
            let completed = 0
            let error = 0
            let processedItems = 0
            let percent = 0

            if (batch.job_type === 'product_texts') {
              itemsToCheck = selectedIndices.length > 0 
                ? selectedIndices.map(index => batch.products[index]).filter(Boolean)
                : batch.products;
              
              total = itemsToCheck.length
              pending = itemsToCheck.filter(p => p.status === 'pending').length
              optimizing = itemsToCheck.filter(p => p.status === 'optimizing').length
              optimized = itemsToCheck.filter(p => p.status === 'optimized').length
              translating = itemsToCheck.filter(p => p.status === 'translating').length
              completed = itemsToCheck.filter(p => p.status === 'completed').length
              error = itemsToCheck.filter(p => p.status === 'error').length

              // Calculate progress based on current phase
              if (optimizing > 0 || optimized > 0) {
                // Optimization phase: count optimized + completed as processed
                processedItems = optimized + completed
                percent = total > 0 ? Math.round((processedItems / total) * 100) : 0
              } else if (translating > 0) {
                // Translation phase: count actual translations completed
                const productsWithTranslations = itemsToCheck.filter(p => 
                  (p.translated_da && p.translated_da.trim()) || 
                  (p.translated_no && p.translated_no.trim()) ||
                  (p.translated_en && p.translated_en.trim()) ||
                  (p.translated_de && p.translated_de.trim()) ||
                  (p.translated_fr && p.translated_fr.trim()) ||
                  (p.translated_es && p.translated_es.trim()) ||
                  (p.translated_it && p.translated_it.trim()) ||
                  (p.translated_pt && p.translated_pt.trim()) ||
                  (p.translated_nl && p.translated_nl.trim()) ||
                  (p.translated_pl && p.translated_pl.trim()) ||
                  (p.translated_ru && p.translated_ru.trim()) ||
                  (p.translated_fi && p.translated_fi.trim())
                ).length
                processedItems = productsWithTranslations
                percent = total > 0 ? Math.round((productsWithTranslations / total) * 100) : 0
              } else {
                // Default: count non-pending as processed
                processedItems = total - pending
                percent = total > 0 ? Math.round((processedItems / total) * 100) : 0
              }
            } else {
              // UI items
              itemsToCheck = selectedIndices.length > 0 
                ? selectedIndices.map(index => batch.ui_items[index]).filter(Boolean)
                : batch.ui_items;
              
              total = itemsToCheck.length
              pending = itemsToCheck.filter(p => p.status === 'pending').length
              optimizing = itemsToCheck.filter(p => p.status === 'processing').length // UI items use 'processing'
              optimized = 0 // UI items don't have optimized status
              translating = 0 // UI items don't have translating status
              completed = itemsToCheck.filter(p => p.status === 'completed').length
              error = itemsToCheck.filter(p => p.status === 'error').length

              // For UI items: count completed as processed
              processedItems = completed
              percent = total > 0 ? Math.round((processedItems / total) * 100) : 0
            }

            console.log(`[EVENTS] Progress update for batch ${batchId}:`, {
              total,
              pending,
              optimizing,
              optimized,
              translating,
              completed,
              error,
              processedItems,
              percent
            })

            const progressData = {
              type: 'progress',
              data: {
                done: processedItems,
                total,
                percent,
                counts: {
                  pending,
                  optimizing,
                  optimized,
                  translating,
                  completed,
                  error
                }
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`))

            // Check if all done
            if (batch.job_type === 'product_texts') {
              if (pending === 0 && optimizing === 0 && translating === 0) {
                console.log(`[EVENTS] Optimization complete for batch ${batchId}, closing stream`)
                controller.enqueue(encoder.encode('data: {"type":"end"}\n\n'))
                clearInterval(progressInterval)
                if (heartbeatInterval) clearInterval(heartbeatInterval)
                controller.close()
              }
            } else {
              // For UI items: check if all are completed or have errors
              if (pending === 0 && optimizing === 0) {
                console.log(`[EVENTS] Translation complete for batch ${batchId}, closing stream`)
                controller.enqueue(encoder.encode('data: {"type":"end"}\n\n'))
                clearInterval(progressInterval)
                if (heartbeatInterval) clearInterval(heartbeatInterval)
                controller.close()
              }
            }
          } catch (error) {
            console.error('Progress monitoring error:', error)
            controller.enqueue(encoder.encode('data: {"type":"error","message":"Progress monitoring failed"}\n\n'))
            clearInterval(progressInterval)
            if (heartbeatInterval) clearInterval(heartbeatInterval)
            controller.close()
          }
        }, 2000)

        // Send heartbeat every 30 seconds to keep connection alive
        heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode('data: {"type":"heartbeat"}\n\n'))
          } catch (error) {
            // Controller is closed, clear interval
            if (heartbeatInterval) clearInterval(heartbeatInterval)
          }
        }, 30000)

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(progressInterval)
          if (heartbeatInterval) clearInterval(heartbeatInterval)
          controller.close()
        })
      } catch (error) {
        controller.enqueue(encoder.encode('data: {"type":"error","message":"Failed to start monitoring"}\n\n'))
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}
