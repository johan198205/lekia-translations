import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const glossaryEntrySchema = z.object({
  id: z.string(),
  source: z.string().min(1).max(120),
  comment: z.string().optional(),
  targets: z.record(z.string(), z.string())
});

const updateGlossarySchema = z.object({
  glossary: z.array(glossaryEntrySchema).optional()
});

/**
 * GET /api/settings/glossary
 * Returns current glossary entries
 */
export async function GET() {
  try {
    const settings = await prisma.openAISettings.findFirst({
      orderBy: { updated_at: 'desc' }
    });

    if (!settings || !settings.glossary) {
      return NextResponse.json({ glossary: [] });
    }

    try {
      const glossary = JSON.parse(settings.glossary);
      return NextResponse.json({ glossary });
    } catch (error) {
      console.error('Error parsing glossary:', error);
      return NextResponse.json({ glossary: [] });
    }
  } catch (error) {
    console.error('Error fetching glossary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch glossary' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/glossary
 * Updates glossary entries
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = updateGlossarySchema.parse(body);

    // Get existing settings
    const existingSettings = await prisma.openAISettings.findFirst({
      orderBy: { updated_at: 'desc' }
    });

    const glossaryData = validatedData.glossary ? JSON.stringify(validatedData.glossary) : null;

    let settings;
    if (existingSettings) {
      // Update existing settings
      settings = await prisma.openAISettings.update({
        where: { id: existingSettings.id },
        data: { glossary: glossaryData }
      });
    } else {
      // Create new settings with defaults
      settings = await prisma.openAISettings.create({
        data: {
          openaiModel: 'gpt-4o-mini',
          promptOptimizeSv: '',
          promptTranslateDirect: '',
          glossary: glossaryData
        }
      });
    }

    const glossary = settings.glossary ? JSON.parse(settings.glossary) : [];
    return NextResponse.json({ glossary });
  } catch (error) {
    console.error('Error updating glossary:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update glossary' },
      { status: 500 }
    );
  }
}
