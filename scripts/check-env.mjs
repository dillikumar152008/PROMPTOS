import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env.local');

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found in project root.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envMap = new Map();

for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    // Strip wrapping quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).trim();
    }

    envMap.set(key, val);
  }
}

for (const varName of REQUIRED_VARS) {
  const val = envMap.get(varName);
  const status = val && val.length > 0 ? 'SET' : 'MISSING';
  // STRICT RULE: Only print the variable name and "SET" or "MISSING". Never print any value.
  console.log(`${varName}: ${status}`);
}
