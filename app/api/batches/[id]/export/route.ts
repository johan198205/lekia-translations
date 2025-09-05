import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params

    // Get batch with products or UI items
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

    if (batch.job_type === 'product_texts') {
      // Export products
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Produkter')
      
      // Add headers
      worksheet.columns = [
        { header: 'Produktnamn', key: 'name', width: 30 },
        { header: 'Beskrivning (SV)', key: 'description', width: 50 },
        { header: 'Optimerad text (SV)', key: 'optimized', width: 50 },
        { header: 'Översatt till norska (NO)', key: 'translated_no', width: 50 },
        { header: 'Översatt till danska (DK)', key: 'translated_da', width: 50 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Felmeddelande', key: 'error', width: 30 }
      ]

      // Add data rows
      batch.products.forEach(product => {
        worksheet.addRow({
          name: product.name_sv,
          description: product.description_sv,
          optimized: product.optimized_sv || '',
          translated_no: product.translated_no || '',
          translated_da: product.translated_da || '',
          status: product.status,
          error: product.error_message || ''
        })
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${batch.filename}_export.xlsx"`
        }
      })
    } else {
      // Export UI items
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('UI-element')
      
      // Get all unique locales from all UI items
      const allLocales = new Set<string>()
      batch.ui_items.forEach(item => {
        const values = JSON.parse(item.values)
        Object.keys(values).forEach(locale => allLocales.add(locale))
      })
      
      // Add headers
      const columns = [
        { header: 'Namn', key: 'name', width: 30 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Felmeddelande', key: 'error', width: 30 }
      ]
      
      // Add locale columns
      Array.from(allLocales).sort().forEach(locale => {
        columns.push({ header: locale, key: locale, width: 40 })
      })
      
      worksheet.columns = columns

      // Add data rows
      batch.ui_items.forEach(item => {
        const values = JSON.parse(item.values)
        const row: any = {
          name: item.name,
          status: item.status,
          error: item.error_message || ''
        }
        
        // Add each locale value
        Object.entries(values).forEach(([locale, value]) => {
          row[locale] = value || ''
        })
        
        worksheet.addRow(row)
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${batch.filename}_ui_export.xlsx"`
        }
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}