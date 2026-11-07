const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const values = new Set();
function scan(dir) { for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
 const p = path.join(dir, entry.name);
 if(entry.isDirectory()) scan(p);
 else if(/\.tsx?$/.test(p) && !/locale|preferences|themes/.test(p)) {
  const ast = parser.parse(fs.readFileSync(p,'utf8'), {sourceType:'module',plugins:['typescript','jsx']});
  traverse(ast,{StringLiteral(p){if (/[\u0600-\u06ff]/.test(p.node.value)) values.add(p.node.value.replace(/\s+/g,' ').trim());}, JSXText(p){if (/[\u0600-\u06ff]/.test(p.node.value)) values.add(p.node.value.replace(/\s+/g,' ').trim());}});
 }
}}
scan('src');
const dict = fs.readFileSync('src/locale.ts','utf8');
const missing = [...values].filter(v=>!dict.includes(JSON.stringify(v)+':'));
console.log(missing.length ? missing.join('\n') : 'PASS all static Arabic UI copy has an English translation');
process.exitCode = missing.length ? 1 : 0;
