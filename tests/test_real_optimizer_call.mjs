import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { PROMPT_OPTIMIZER_SYSTEM_INSTRUCTION } from '../lib/optimizer/config.js';

const envContent = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envContent.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
const modelMatch = envContent.match(/^GEMINI_MODEL\s*=\s*(.*)$/m);

const apiKey = keyMatch[1].trim();
const model = modelMatch ? modelMatch[1].trim() : 'gemini-3.8-flash';

console.log('Testing REAL optimizer call with model:', model);

const ai = new GoogleGenAI({ apiKey });

async function run() {
  const testPrompt = 'summarize financial history for customer [AADHAAR_1] and give bullet points of debts';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
      config: {
        systemInstruction: PROMPT_OPTIMIZER_SYSTEM_INSTRUCTION,
        maxOutputTokens: 600,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const output = response.text?.trim() || '';
    console.log('REAL CALL RESULT: SUCCESS');
    console.log('Output length:', output.length);
    console.log('Does output preserve [AADHAAR_1]?:', output.includes('[AADHAAR_1]'));
    console.log('First 200 chars of optimized output:');
    console.log(output.slice(0, 200));
  } catch (err) {
    console.error('REAL CALL FAILED:', err.message);
    process.exit(1);
  }
}

run();
