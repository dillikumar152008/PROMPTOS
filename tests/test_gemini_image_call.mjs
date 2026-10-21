import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// 1. Read GEMINI_API_KEY and GEMINI_MODEL from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envContent.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
const modelMatch = envContent.match(/^GEMINI_MODEL\s*=\s*(.*)$/m);

if (!keyMatch || !keyMatch[1]) {
  console.error('FAIL: GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

const apiKey = keyMatch[1].trim();
const configuredModel = modelMatch ? modelMatch[1].trim() : 'gemini-3.8-flash';
console.log('Configured GEMINI_MODEL from .env.local:', configuredModel);

const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log('\n[1] Querying Google model list...');
  try {
    const listRes = await ai.models.list();
    const models = [];
    for await (const m of listRes) {
      if (m.name) models.push(m.name.replace(/^models\//, ''));
    }
    console.log(`Found ${models.length} accessible models.`);
    const matchesConfigured = models.includes(configuredModel);
    console.log(`Does model list contain configured "${configuredModel}"?`, matchesConfigured);
    const flashModels = models.filter(m => m.includes('flash'));
    console.log('Available flash models:', flashModels.slice(0, 10));
  } catch (err) {
    console.warn('Listing models warning:', err.message);
  }

  console.log('\n[2] Making a real test call to Gemini with a real image...');
  // Minimal valid 1x1 transparent PNG in base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    const response = await ai.models.generateContent({
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
            {
              text: 'Describe what you see in this 1x1 pixel image in 1 short sentence.',
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 60,
      },
    });

    console.log('SUCCESS! Real image test call succeeded.');
    console.log('Model response text:', response.text?.trim());
  } catch (err) {
    console.error('FAIL: Real image call failed with error:', err.message);
    process.exit(1);
  }
}

run();
