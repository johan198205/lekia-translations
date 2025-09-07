import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/init-db
 * Initialize database tables if they don't exist
 */
export async function POST() {
  try {
    // Try to create a simple record to test if tables exist
    // This will automatically create tables if they don't exist
    await prisma.$executeRaw`SELECT 1`;
    
    // Try to access the OpenAISettings table
    await prisma.openAISettings.findFirst();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully' 
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    
    try {
      // If tables don't exist, try to create them
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "OpenAISettings" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "openaiApiKeyEnc" TEXT,
          "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
          "promptOptimizeSv" TEXT NOT NULL DEFAULT '',
          "promptTranslateDirect" TEXT NOT NULL DEFAULT '',
          "exampleProductImportTokens" TEXT,
          "translationLanguages" TEXT,
          "originalLanguage" TEXT,
          "glossary" TEXT,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      return NextResponse.json({ 
        success: true, 
        message: 'Database tables created successfully' 
      });
    } catch (createError) {
      console.error('Table creation error:', createError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to initialize database',
          details: createError instanceof Error ? createError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
}
