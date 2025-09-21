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

    // Determine job type based on filename or try both
    let jobType: 'product_texts' | 'brands' = 'product_texts';
    console.log(`[AnalyzeTokens] Uploaded file name: ${file.name}`); // LOG 1
    
    // Normalize filename for better matching
    const normalizedFilename = file.name.toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/å/g, 'a');
    
    console.log(`[AnalyzeTokens] Normalized filename: ${normalizedFilename}`); // LOG 1.5
    
    if (normalizedFilename.includes('brand') || 
        normalizedFilename.includes('varumark') || 
        normalizedFilename.includes('varumarken')) {
      jobType = 'brands';
    }
    console.log(`[AnalyzeTokens] Initial jobType determined: ${jobType}`); // LOG 2

    // Try to normalize with determined job type first
    let result;
    try {
      result = await normalize(buffer, jobType);
      console.log(`[AnalyzeTokens] Normalization successful with jobType: ${jobType}`); // LOG 3
    } catch (error) {
      console.log(`[AnalyzeTokens] Normalization failed with jobType: ${jobType}. Trying fallback.`); // LOG 4
      console.log(`[AnalyzeTokens] Error details:`, error); // LOG 4.5
      // If it fails, try the other job type
      const otherJobType = jobType === 'product_texts' ? 'brands' : 'product_texts';
      try {
        result = await normalize(buffer, otherJobType);
        jobType = otherJobType;
        console.log(`[AnalyzeTokens] Fallback successful with jobType: ${jobType}`); // LOG 5
      } catch (fallbackError) {
        console.error(`[AnalyzeTokens] Fallback also failed with jobType: ${otherJobType}`, fallbackError); // LOG 6
        // If both fail, throw the original error
        throw error;
      }
    }

    // Return tokens and detected languages information
    return NextResponse.json({
      success: true,
      tokens: result.meta?.tokens || { tokens: [], systemTokens: [] },
      detectedLanguages: result.meta?.detectedLanguages || [],
      suggestedOriginalLanguage: result.meta?.suggestedOriginalLanguage,
      filename: file.name
    });

  } catch (error) {
    console.error('[AnalyzeTokens] Error during token analysis:', error); // LOG 7
    
    if (error instanceof Error && error.message.includes('Missing required columns')) {
      return NextResponse.json(
        { error: 'File must contain the required columns for the file type. For products: "name_sv" and "description_sv". For brands: appropriate brand columns.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze file. Please check the file format.' },
      { status: 500 }
    );
  }
}