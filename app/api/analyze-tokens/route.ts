import { NextRequest, NextResponse } from 'next/server';
import { normalize } from '@/lib/excel/normalize';

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // Some systems send this for .xlsx
];

/**
 * POST /api/analyze-tokens
 * Analyzes an Excel file and extracts tokens without saving to database
 */
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
        { error: 'Invalid file type. Only .xlsx files are supported.' },
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
        { error: 'File too large. Maximum size is 16MB.' },
        { status: 413 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Normalize Excel data to extract tokens
    const result = await normalize(buffer, 'product_texts');

    // Return only the tokens information
    return NextResponse.json({
      success: true,
      tokens: result.meta?.tokens || { tokens: [], systemTokens: [] },
      filename: file.name
    });

  } catch (error) {
    console.error('Token analysis error:', error);
    
    if (error instanceof Error && error.message.includes('Missing required columns')) {
      return NextResponse.json(
        { error: 'File must contain at least "name_sv" and "description_sv" columns' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze file. Please check the file format.' },
      { status: 500 }
    );
  }
}
