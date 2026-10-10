// يستبدل نمط «loading/saving.set(true) + subscribe({next, error})» المكرَّر بـ trackRequest() المشتركة.
// تشغيل: node scripts/phase4-track.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { walk, root } from './codemod-move.mjs';

const DRY = process.argv.includes('--dry');

/** يعيد فهرس القوس/الحاضن المطابق لـ open في s (يتجاوز النصوص والتعليقات) */
function matchClose(s, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [pairs[s[open]]];
  for (let i = open + 1; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {                       // نص
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; else if (q === '`' && s[i] === '$' && s[i + 1] === '{') { i = matchClose(s, i + 1); } i++; }
      continue;
    }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if ('({['.includes(c)) stack.push(pairs[c]);
    else if (')}]'.includes(c)) { if (c !== stack.pop()) return -1; if (!stack.length) return i; }
  }
  return -1;
}

/** يقسم نص كائن { a: ..., b: ... } إلى مفاتيح/قيم على المستوى الأول */
function splitTop(body) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'" || c === '"' || c === '`') { const q = c; i++; while (i < body.length && body[i] !== q) { if (body[i] === '\\') i++; i++; } continue; }
    if ('({['.includes(c)) depth++;
    else if (')}]'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  return parts.map(p => p.trim()).filter(Boolean);
}

const HEAD = /this\.(loading|saving|busy)\.set\(true\);[ \t]*this\.(\w+)\.set\(''\);/g;

function transform(src, file) {
  let out = '', pos = 0, count = 0;
  HEAD.lastIndex = 0;
  for (let m; (m = HEAD.exec(src));) {
    const [head, flag, err] = m;
    let i = m.index + head.length;
    // عبارات تمهيدية بسيطة بعد الرأس (مثل this.success.set('');)
    let extra = '';
    for (;;) {
      const mm = /^[ \t\r\n]*(this\.\w+\.set\((?:''|\[\])\);)/.exec(src.slice(i));
      if (!mm || mm[1].startsWith(`this.${flag}.`)) break;
      extra += ' ' + mm[1]; i += mm[0].length;
    }
    // نبحث عن .subscribe({ على عمق 0
    let depth = 0, j = i, found = -1;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "'" || c === '"' || c === '`') { const q = c; j++; while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; } continue; }
      if ('({['.includes(c)) depth++;
      else if (')}]'.includes(c)) { depth--; if (depth < 0) break; }
      else if (c === ';' && depth === 0) break;
      else if (depth === 0 && src.startsWith('.subscribe({', j)) { found = j; break; }
    }
    if (found < 0) continue;
    const srcExpr = src.slice(i, found).trim();
    const objOpen = found + '.subscribe('.length;
    const objClose = matchClose(src, objOpen);
    if (objClose < 0 || src[objClose + 1] !== ')') continue;
    let end = objClose + 2; if (src[end] === ';') end++;
    const props = splitTop(src.slice(objOpen + 1, objClose));
    const next = props.find(p => /^next\s*:/.test(p)), error = props.find(p => /^error\s*:/.test(p));
    if (!next || !error || props.length !== 2) continue;
    // معالج الخطأ المقبول فقط
    const errBody = error.replace(/^error\s*:\s*/, '').replace(/\s+/g, ' ');
    const okErr = [
      `e => { this.${flag}.set(false); this.${err}.set(e.message); }`,
      `e => { this.${err}.set(e.message); this.${flag}.set(false); }`,
      `error => { this.${flag}.set(false); this.${err}.set(error.message); }`,
      `error => { this.${err}.set(error.message); this.${flag}.set(false); }`
    ];
    if (!okErr.includes(errBody)) continue;
    const nm = /^next\s*:\s*([\s\S]*)$/.exec(next)[1].trim();
    const am = /^(\([^)]*\)|\w+)\s*=>\s*([\s\S]*)$/.exec(nm);
    if (!am) continue;
    const [, param, bodyRaw] = am;
    const flagOff = `this.${flag}.set(false);`;
    let body = bodyRaw.trim();
    if (body.startsWith('{')) {
      if (!body.includes(flagOff)) continue;
      body = body.replace(new RegExp(`[ \\t]*${flagOff.replace(/[.()]/g, '\\$&')}[ \\t]*`), ' ').replace(/\{\s+/, '{ ').replace(/\s+\}$/, ' }').replace(/\{\s*\}/, '{}');
    } else continue;   // تعبير مباشر بلا إغلاق للمؤشر: نتركه
    const indent = /([ \t]*)$/.exec(src.slice(0, m.index))[1];
    const call = `trackRequest(${srcExpr.replace(/\s*\n\s*/g, ' ')}, this.${flag}, this.${err}, ${param} => ${body});`;
    out += src.slice(pos, m.index) + (extra ? extra.trim() + `\n${indent}` : '') + call;
    pos = end; count++;
    HEAD.lastIndex = end;
  }
  out += src.slice(pos);
  return { out, count };
}

let total = 0, files = 0;
for (const file of walk(root)) {
  if (/\.spec\.ts$/.test(file) || /loader\.ts$/.test(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!HEAD.test(src)) { HEAD.lastIndex = 0; continue; }
  HEAD.lastIndex = 0;
  const { out, count } = transform(src, file);
  if (!count) continue;
  total += count; files++;
  if (!DRY) {
    let res = out;
    if (!/trackRequest[^;]*from '@shared\/ui\/loader'/.test(res) && !/import \{[^}]*trackRequest[^}]*\}/.test(res)) {
      const idx = res.indexOf('\n', res.lastIndexOf('\nimport ') + 1);
      res = res.slice(0, idx + 1) + "import { trackRequest } from '@shared/ui/loader';\n" + res.slice(idx + 1);
    }
    fs.writeFileSync(file, res);
  }
  console.log(path.relative(root, file), count);
}
console.log('total', total, 'files', files);
