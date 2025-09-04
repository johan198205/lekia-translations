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

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
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
    const result = await normalize(buffer);

    // Create upload first
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        upload_date: new Date(),
        total_products: result.products.length
      }
    });

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
