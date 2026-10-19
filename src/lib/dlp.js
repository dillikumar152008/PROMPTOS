// PromptOS local-first DLP module (ES module, no dependencies, runs in the browser).
// Usage:
//   import { scanPrompt, maskPrompt, restorePlaceholders, summarize } from './dlp.js';
//   const findings = scanPrompt(text);                    // live, while typing
//   const { masked, map } = maskPrompt(text, findings);   // send `masked` to the backend
//   const shown = restorePlaceholders(reply, map);        // restore in the browser only
// Keep `map` in memory (React state/ref). Never save it to Supabase, localStorage or logs.

const D=[[0,1,2,3,4,5,6,7,8,9],
[1,2,3,4,0,6,7,8,9,5],
[2,3,4,0,1,7,8,9,5,6],
[3,4,0,1,2,8,9,5,6,7],
[4,0,1,2,3,9,5,6,7,8],
[5,9,8,7,6,0,4,3,2,1],
[6,5,9,8,7,1,0,4,3,2],
[7,6,5,9,8,2,1,0,4,3],
[8,7,6,5,9,3,2,1,0,4],
[9,8,7,6,5,4,3,2,1,0]];

const P=[[0,1,2,3,4,5,6,7,8,9],
[1,5,7,6,2,8,3,0,9,4],
[5,8,0,3,7,9,6,1,4,2],
[8,9,1,6,0,4,3,5,2,7],
[9,4,5,3,1,2,6,8,7,0],
[4,2,8,6,5,7,3,9,0,1],
[2,7,9,3,8,0,6,4,1,5],
[7,0,4,6,9,1,3,2,5,8]];

export function verhoeffValid(s){
  let c=0; const a=s.split('').reverse();
  for(let i=0;i<a.length;i++) c=D[c][P[i%8][+a[i]]];
  return c===0;
}

export function luhnValid(s){
  let sum=0, alt=false;
  for(let i=s.length-1;i>=0;i--){ let n=+s[i]; if(alt){ n*=2; if(n>9) n-=9; } sum+=n; alt=!alt; }
  return sum%10===0;
}

// Tamil (U+0BE6..) and Devanagari (U+0966..) digits -> ASCII, 1:1 so positions stay aligned.
const norm=t=>t
  .replace(/[\u0966-\u096F]/g,c=>c.charCodeAt(0)-0x0966)
  .replace(/[\u0BE6-\u0BEF]/g,c=>c.charCodeAt(0)-0x0BE6);

const KW=/aadhaar|aadhar|uid|ஆதார்|आधार/i;
const near=(t,s,e)=>KW.test(t.slice(Math.max(0,s-30),s))||KW.test(t.slice(e,e+12));

const CARD =/(?<!\d[ -]?)(?:\d[ -]?){12,18}\d(?![ -]?\d)/g;
const AADHAAR=/(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g;
const PAN  =/(?<![A-Z0-9])[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z](?![A-Z0-9])/gi;
const PHONE=/(?<!\d[ -]?)(?:\+91[ -]?|91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?![ -]?\d)/g;
const EMAIL=/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const KEY  =/\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})\b/g;

export const LABELS=
{AADHAAR:'Aadhaar',PAN:'PAN',PHONE:'Phone',CARD:'Card',EMAIL:'Email',API_KEY:'API key'};

export function scanPrompt(raw){
  const t=norm(raw), out=[], used=[];
  const free=(s,e)=>!used.some(u=>s<u[1]&&e>u[0]);
  const add=(type,s,e,confidence)=>{
used.push([s,e]);
out.push({type,start:s,end:e,confidence,value:raw.slice(s,e)}); };
  const run=(rx,fn)=>{ for(const m of t.matchAll(rx)) fn(m[0],m.index,m.index+m[0].length); };

  // Card: Luhn + 15-16 digits + known first digit (cuts false alarms on 13-digit timestamps).
  run(CARD,(m,s,e)=>{ const d=m.replace(/\D/g,'');
if((d.length===15||d.length===16)&&/^[3-6]/.test(d)&&luhnValid(d))
add('CARD',s,e,'high'); });
  run(AADHAAR,(m,s,e)=>{
    if(!free(s,e)) return;
    const d=m.replace(/\D/g,'');
    if(verhoeffValid(d))
add('AADHAAR',s,e,'high');
    else if(near(t,s,e))
add('AADHAAR',s,e,'medium'); // mistyped number next to the word "Aadhaar"
  });
  run(PAN,(m,s,e)=>{ if(free(s,e))
add('PAN',s,e,'high'); });
  run(PHONE,(m,s,e)=>{ if(free(s,e))
add('PHONE',s,e,/^(\+91|91)/.test(m)?'high':'medium'); });
  run(EMAIL,(m,s,e)=>{ if(free(s,e))
add('EMAIL',s,e,'high'); });
  run(KEY,(m,s,e)=>{ if(free(s,e))
add('API_KEY',s,e,'high'); });
  return out.sort((a,b)=>a.start-b.start);
}

export function extractMaxIndices(textOrArray) {
  const counts = {};
  const texts = Array.isArray(textOrArray) ? textOrArray : [textOrArray || ''];
  const regex = /\[([A-Z_]+)_(\d+)\]/g;
  for (const t of texts) {
    if (!t || typeof t !== 'string') continue;
    for (const m of t.matchAll(regex)) {
      const type = m[1];
      const num = parseInt(m[2], 10);
      if (!isNaN(num)) {
        counts[type] = Math.max(counts[type] || 0, num);
      }
    }
  }
  return counts;
}

export function maskPrompt(raw, findings, baseCounts = {}) {
  const counts = { ...baseCounts };
  const items = findings.map((f) => {
    counts[f.type] = (counts[f.type] || 0) + 1;
    return { ...f, placeholder: `[${f.type}_${counts[f.type]}]` };
  });
  let masked = raw;
  for (const it of [...items].reverse())
    masked = masked.slice(0, it.start) + it.placeholder + masked.slice(it.end);
  const map = {};
  items.forEach((it) => {
    map[it.placeholder] = it.value;
  });
  return { masked, map };
}

export function restorePlaceholders(text,map){
  let out=text;
  for(const [ph,val] of Object.entries(map))
out=out.split(ph).join(val);
  return out;
}

// For the banner: [{type:'AADHAAR', label:'Aadhaar', count:1}, ...]
export function summarize(findings){
  const c={}; findings.forEach(f=>{
c[f.type]=(c[f.type]||0)+1; });
  return Object.entries(c).map(([type,count])=>
({type,label:LABELS[type],count}));
}
