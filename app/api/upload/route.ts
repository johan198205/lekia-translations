import { NextRequest, NextResponse } from 'next/server';
import { normalize, NormalizationError } from '@/lib/excel/normalize';
import { prisma } from '@/lib/prisma';

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // Some systems send this for .xlsx
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const jobType = (formData.get('jobType') as string) || 'product_texts';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!['product_texts', 'ui_strings'].includes(jobType)) {
      return NextResponse.json(
        { error: 'Invalid job type' },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large' },
        { status: 413 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Normalize Excel data
    const result = await normalize(buffer, jobType as 'product_texts' | 'ui_strings');

    // Create upload first
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        upload_date: new Date(),
        total_products: jobType === 'product_texts' ? (result.products?.length || 0) : (result.uiStrings?.length || 0),
        job_type: jobType as 'product_texts' | 'ui_strings'
      }
    });

    if (jobType === 'product_texts' && result.products) {
      // Create products with upload_id (no batch_id initially)
      const products = await Promise.all(
        result.products.map(async (product) => {
          return await prisma.product.create({
            data: {
              name_sv: product.name_sv,
              description_sv: product.description_sv,
              attributes: product.attributes,
              tone_hint: product.tone_hint,
              status: 'pending',
              upload_id: upload.id
            }
          });
        })
      );

      console.log(`[UPLOAD] Created ${products.length} products for upload ${upload.id}`);
      console.log(`[UPLOAD] Product IDs:`, products.map(p => p.id));

      // Verify products were created by fetching them back
      const verifyProducts = await prisma.product.findMany({
        where: { upload_id: upload.id }
      });
      console.log(`[UPLOAD] Verified ${verifyProducts.length} products in database for upload ${upload.id}`);

      return NextResponse.json({
        uploadId: upload.id,
        products: result.products,
        meta: result.meta
      });
    } else if (jobType === 'ui_strings' && result.uiStrings) {
      // Create UI items with upload_id (no batch_id initially)
      const uiItems = await Promise.all(
        result.uiStrings.map(async (uiString) => {
          return await prisma.uIItem.create({
            data: {
              name: uiString.name,
              values: JSON.stringify(uiString.values),
              status: 'pending',
              upload_id: upload.id
            }
          });
        })
      );

      console.log(`[UPLOAD] Created ${uiItems.length} UI items for upload ${upload.id}`);
      console.log(`[UPLOAD] UI Item IDs:`, uiItems.map(item => item.id));

      // Verify UI items were created by fetching them back
      const verifyUIItems = await prisma.uIItem.findMany({
        where: { upload_id: upload.id }
      });
      console.log(`[UPLOAD] Verified ${verifyUIItems.length} UI items in database for upload ${upload.id}`);

      return NextResponse.json({
        uploadId: upload.id,
        uiStrings: result.uiStrings,
        meta: result.meta
      });
    } else {
      throw new Error('Invalid result structure for job type');
    }
  } catch (error) {
    if (error instanceof NormalizationError) {
      if (error.message.includes('Missing required columns')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('Invalid workbook')) {
        return NextResponse.json(
          { error: 'Invalid workbook' },
          { status: 400 }
        );
      }
    }

    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
