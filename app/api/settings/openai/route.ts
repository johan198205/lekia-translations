import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/encryption';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  apiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  promptOptimizeSv: z.string().optional(),
  promptTranslateDirect: z.string().optional(),
  exampleProductImportTokens: z.string().optional()
});

/**
 * GET /api/settings/openai
 * Returns current OpenAI settings (API key is masked)
 */
export async function GET() {
  try {
    const settings = await prisma.openAISettings.findFirst({
      orderBy: { updated_at: 'desc' }
    });

    if (!settings) {
      return NextResponse.json({
        hasKey: false,
        openaiModel: 'gpt-4o-mini',
        promptOptimizeSv: '',
        promptTranslateDirect: '',
        exampleProductImportTokens: null,
        updatedAt: null
      });
    }

    return NextResponse.json({
      hasKey: !!settings.openaiApiKeyEnc,
      openaiModel: settings.openaiModel,
      promptOptimizeSv: settings.promptOptimizeSv,
      promptTranslateDirect: settings.promptTranslateDirect,
      exampleProductImportTokens: settings.exampleProductImportTokens,
      updatedAt: settings.updated_at
    });
  } catch (error) {
    console.error('Error fetching OpenAI settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/openai
 * Updates OpenAI settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);

    // Get existing settings
    const existingSettings = await prisma.openAISettings.findFirst({
      orderBy: { updated_at: 'desc' }
    });

    const updateData: any = {};

    // Only update fields that are provided
    if (validatedData.apiKey !== undefined) {
      if (validatedData.apiKey && validatedData.apiKey.trim()) {
        updateData.openaiApiKeyEnc = encryptSecret(validatedData.apiKey);
      } else {
        updateData.openaiApiKeyEnc = null;
      }
    }

    if (validatedData.openaiModel !== undefined) {
      updateData.openaiModel = validatedData.openaiModel;
    }

    if (validatedData.promptOptimizeSv !== undefined) {
      updateData.promptOptimizeSv = validatedData.promptOptimizeSv;
    }

    if (validatedData.promptTranslateDirect !== undefined) {
      updateData.promptTranslateDirect = validatedData.promptTranslateDirect;
    }

    if (validatedData.exampleProductImportTokens !== undefined) {
      // Validate that it's valid JSON if provided
      if (validatedData.exampleProductImportTokens && validatedData.exampleProductImportTokens.trim()) {
        try {
          JSON.parse(validatedData.exampleProductImportTokens);
          updateData.exampleProductImportTokens = validatedData.exampleProductImportTokens;
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid JSON format for exampleProductImportTokens' },
            { status: 400 }
          );
        }
      } else {
        updateData.exampleProductImportTokens = null;
      }
    }

    let settings;
    if (existingSettings) {
      // Update existing settings
      settings = await prisma.openAISettings.update({
        where: { id: existingSettings.id },
        data: updateData
      });
    } else {
      // Create new settings with defaults
      const createData: any = {
        openaiModel: updateData.openaiModel || 'gpt-4o-mini',
        promptOptimizeSv: updateData.promptOptimizeSv || '',
        promptTranslateDirect: updateData.promptTranslateDirect || '',
        exampleProductImportTokens: updateData.exampleProductImportTokens || null
      };
      
      // Only set API key if it was provided
      if (updateData.openaiApiKeyEnc !== undefined) {
        createData.openaiApiKeyEnc = updateData.openaiApiKeyEnc;
      }
      
      settings = await prisma.openAISettings.create({
        data: createData
      });
    }

    return NextResponse.json({
      hasKey: !!settings.openaiApiKeyEnc,
      openaiModel: settings.openaiModel,
      promptOptimizeSv: settings.promptOptimizeSv,
      promptTranslateDirect: settings.promptTranslateDirect,
      exampleProductImportTokens: settings.exampleProductImportTokens,
      updatedAt: settings.updated_at
    });
  } catch (error) {
    console.error('Error updating OpenAI settings:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
