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
              }
            }
          })

          if (!batch) {
            controller.enqueue(encoder.encode('data: {"type":"error","message":"Batch not found"}\n\n'))
            controller.close()
            return
          }

          // Calculate initial progress - only for selected products
          const productsToCheck = selectedIndices.length > 0 
            ? selectedIndices.map(index => batch.products[index]).filter(Boolean)
            : batch.products;
          
          const total = productsToCheck.length
          const pending = productsToCheck.filter(p => p.status === 'pending').length
          const optimizing = productsToCheck.filter(p => p.status === 'optimizing').length
          const optimized = productsToCheck.filter(p => p.status === 'optimized').length
          const translating = productsToCheck.filter(p => p.status === 'translating').length
          const completed = productsToCheck.filter(p => p.status === 'completed').length
          const error = productsToCheck.filter(p => p.status === 'error').length

          const processedProducts = total - pending
          const percent = total > 0 ? Math.round((processedProducts / total) * 100) : 0

          const initialProgress = {
            type: 'progress',
            data: {
              done: processedProducts,
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

            // Calculate progress - only for selected products
            const productsToCheck = selectedIndices.length > 0 
              ? selectedIndices.map(index => batch.products[index]).filter(Boolean)
              : batch.products;
            
            const total = productsToCheck.length
            const pending = productsToCheck.filter(p => p.status === 'pending').length
            const optimizing = productsToCheck.filter(p => p.status === 'optimizing').length
            const optimized = productsToCheck.filter(p => p.status === 'optimized').length
            const translating = productsToCheck.filter(p => p.status === 'translating').length
            const completed = productsToCheck.filter(p => p.status === 'completed').length
            const error = productsToCheck.filter(p => p.status === 'error').length

            // Calculate progress based on current phase
            let processedProducts: number
            let percent: number
            
            if (optimizing > 0 || optimized > 0) {
              // Optimization phase: count optimized + completed as processed
              processedProducts = optimized + completed
              percent = total > 0 ? Math.round((processedProducts / total) * 100) : 0
            } else if (translating > 0) {
              // Translation phase: count completed as processed (translating is in progress)
              processedProducts = completed
              percent = total > 0 ? Math.round((processedProducts / total) * 100) : 0
            } else {
              // Default: count non-pending as processed
              processedProducts = total - pending
              percent = total > 0 ? Math.round((processedProducts / total) * 100) : 0
            }

            console.log(`[EVENTS] Progress update for batch ${batchId}:`, {
              total,
              pending,
              optimizing,
              optimized,
              translating,
              completed,
              error,
              processedProducts,
              percent
            })

            const progressData = {
              type: 'progress',
              data: {
                done: processedProducts,
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
            if (pending === 0 && optimizing === 0 && translating === 0) {
              console.log(`[EVENTS] Optimization complete for batch ${batchId}, closing stream`)
              controller.enqueue(encoder.encode('data: {"type":"end"}\n\n'))
              clearInterval(progressInterval)
              if (heartbeatInterval) clearInterval(heartbeatInterval)
              controller.close()
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
