/**
 * PromptBuilder - Builds prompts with token replacement
 * Uses tokens from upload meta or falls back to settings example
 */

import { getAvailableTokens, replaceTokens, generateContextBlock, TokenInfo } from '@/lib/token-extractor';

export interface PromptContext {
  targetLang?: string;
  jobType: string;
  uploadName?: string;
  batchName?: string;
  productData?: Record<string, string>;
}

export interface PromptBuilderOptions {
  uploadTokens?: TokenInfo[];
  settingsTokens?: TokenInfo[];
}

export class PromptBuilder {
  private availableTokens: TokenInfo[];

  constructor(options: PromptBuilderOptions) {
    this.availableTokens = getAvailableTokens(options.uploadTokens, options.settingsTokens);
  }

  /**
   * Build a prompt by replacing tokens in the template
   */
  buildPrompt(template: string, context: PromptContext): string {
    // System tokens that are always available
    const systemValues: Record<string, string> = {
      targetLang: context.targetLang || '',
      jobType: context.jobType,
      uploadName: context.uploadName || '',
      batchName: context.batchName || ''
    };

    // Combine system values with product data
    const allValues = { ...systemValues, ...(context.productData || {}) };

    // Replace tokens in the template
    let result = replaceTokens(template, this.availableTokens, allValues);

    // Generate context block for used tokens
    const contextBlock = generateContextBlock(this.availableTokens, allValues);
    result += contextBlock;

    return result;
  }

  /**
   * Get available tokens for display purposes
   */
  getAvailableTokens(): TokenInfo[] {
    return this.availableTokens;
  }

  /**
   * Check if a token is available
   */
  hasToken(token: string): boolean {
    return this.availableTokens.some(t => t.token === token || t.alias === token);
  }
}

/**
 * Create a PromptBuilder instance from upload and settings data
 */
export function createPromptBuilder(
  uploadMeta?: string,
  settingsTokens?: string
): PromptBuilder {
  let uploadTokens: TokenInfo[] | undefined;
  let settingsTokensParsed: TokenInfo[] | undefined;

  // Parse upload tokens
  if (uploadMeta) {
    try {
      const meta = JSON.parse(uploadMeta);
      if (meta.tokens) {
        uploadTokens = meta.tokens.tokens || [];
      }
    } catch (error) {
      console.warn('Failed to parse upload meta:', error);
    }
  }

  // Parse settings tokens
  if (settingsTokens) {
    try {
      const parsed = JSON.parse(settingsTokens);
      settingsTokensParsed = parsed.tokens || [];
    } catch (error) {
      console.warn('Failed to parse settings tokens:', error);
    }
  }

  return new PromptBuilder({
    uploadTokens,
    settingsTokens: settingsTokensParsed
  });
}
