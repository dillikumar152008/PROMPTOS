import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const envContent = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envContent.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
const modelMatch = envContent.match(/^GEMINI_MODEL\s*=\s*(.*)$/m);

const apiKey = keyMatch[1].trim();
const configuredModel = modelMatch ? modelMatch[1].trim() : 'gemini-3.8-flash';

const ai = new GoogleGenAI({ apiKey });

async function run() {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const tokenRes = await ai.models.countTokens({
    model: configuredModel,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: pngBase64,
            },
          },
          { text: 'Hello, how many tokens is this?' },
        ],
      },
    ],
  });

  console.log('Token count result for image + prompt:', tokenRes.totalTokens);
}

run();
