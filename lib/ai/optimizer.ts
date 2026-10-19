export const PROMPT_OPTIMIZER_SLUG = 'prompt-optimizer';

export const PROMPT_OPTIMIZER_SYSTEM_PROMPT = `You are the official Prompt Optimizer for PromptOS.
Your sole purpose is to compress and shorten a prompt while strictly preserving every instruction, constraint, rule, edge case, and output format.

Strict Rules:
1. PRESERVE EVERY DIRECTIVE: Never remove any instruction, rule, constraint, variable, or format requirement.
2. ELIMINATE WASTE: Remove repetitive phrasing, verbose preambles, tautologies, circular explanations, and superfluous filler words.
3. CONCISE STRUCTURE: Use dense, direct imperatives, concise bullet points, and crisp language.
4. NEVER ADD REQUIREMENTS: Do not introduce new assumptions, rules, guidelines, or persona elements not present in the original prompt.

Your response MUST follow this exact format:

### Optimized Prompt
[Insert the complete, optimized prompt here]

### Changes Made
- [Specific change 1]
- [Specific change 2]

### Warnings
[State "None" if nothing was lost, or specify if anything was condensed]`;

export interface OptimizationMetrics {
  tokensBefore: number;
  tokensAfter: number;
  savedTokens: number;
  savedPercent: number;
}

export interface OptimizationResult extends OptimizationMetrics {
  optimizedPrompt: string;
  changes: string[];
  warning: string;
}

/**
 * Calculates token estimate (characters / 4 labeled estimated)
 * Does not require a second model run and incurs zero quota.
 */
export function estimateTokenCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return Math.max(1, Math.round(text.length / 4));
}

/**
 * Parses the structured output from Prompt Optimizer.
 */
export function parseOptimizationOutput(rawText: string, originalInput: string): OptimizationResult {
  if (!rawText) {
    return {
      optimizedPrompt: '',
      changes: [],
      warning: 'None',
      tokensBefore: estimateTokenCount(originalInput),
      tokensAfter: 0,
      savedTokens: 0,
      savedPercent: 0,
    };
  }

  const optMatch = rawText.match(/### Optimized Prompt\s*\n([\s\S]*?)(?=\n### Changes Made|\n### Changes|\n### Warnings|$)/i);
  const changesMatch = rawText.match(/### Changes(?: Made)?\s*\n([\s\S]*?)(?=\n### Warnings|$)/i);
  const warningMatch = rawText.match(/### Warnings?\s*\n([\s\S]*?)$/i);

  const optimizedPrompt = optMatch ? optMatch[1].trim() : rawText.trim();

  let changes: string[] = [];
  if (changesMatch) {
    changes = changesMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  const warning = warningMatch ? warningMatch[1].trim() : 'None';

  const tokensBefore = estimateTokenCount(originalInput);
  const tokensAfter = estimateTokenCount(optimizedPrompt);
  const savedTokens = Math.max(0, tokensBefore - tokensAfter);
  const savedPercent = tokensBefore > 0 ? Math.max(0, Math.round((savedTokens / tokensBefore) * 100)) : 0;

  return {
    optimizedPrompt,
    changes,
    warning,
    tokensBefore,
    tokensAfter,
    savedTokens,
    savedPercent,
  };
}
