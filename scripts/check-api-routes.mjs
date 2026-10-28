// يتحقق أن كل نداء إلى الـ API في الواجهة له نقطة نهاية بالفعل في عقد الباكاند (contract/openapi.json) وبالفعل (GET/POST/PUT/DELETE) نفسه.
// يلتقط ما يُكتب كنص ثابت أو قالب نصي: this.api.get<T>(`/Vacations/Get/${id}`) — فإعادة تسمية مسار أو خطأ إملائي يفشل هنا
// بدل أن يظهر 404 عند المستخدم. النداءات المبنية ديناميكياً (متغير كامل) لا تُلتقط.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const doc = JSON.parse(readFileSync('contract/openapi.json', 'utf8'));
const HOLE = '\u0000';   // مكان تعبير ${...} في القالب

// مسارات الوثيقة كتعابير منتظمة: {id} ← مقطع واحد
const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
  Object.keys(item).map(verb => ({
    verb: verb.toUpperCase(),
    regex: new RegExp('^' + path.replace(/^\/api/, '').replace(/\{[^}]+\}/g, '[^/]+') + '$', 'i')
  })));

const VERBS = { get: 'GET', getBlob: 'GET', post: 'POST', postBlob: 'POST', put: 'PUT', delete: 'DELETE' };

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* sources(full);
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) yield full;
  }
}

/** يقرأ نصاً أو قالباً نصياً يبدأ عند index (يتحمّل ${ ... } المتداخلة وقوالب داخل التعابير) */
function readLiteral(text, index) {
  const quote = text[index];
  let i = index + 1;
  if (quote !== '`') {
    while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
    return { raw: text.slice(index + 1, i), end: i + 1 };
  }
  let out = '';
  while (i < text.length && text[i] !== '`') {
    if (text[i] === '$' && text[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        if (text[i] === '`') i = readLiteral(text, i).end;   // قالب داخل التعبير
        else {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') depth--;
          i++;
        }
      }
      out += HOLE;
    } else {
      out += text[i];
      i++;
    }
  }
  return { raw: out, end: i + 1 };
}

/** المسارات الممكنة: تعبير بعد «/» مقطع كامل، وغيره لاحقة اختيارية (استعلام أو «/id») فنجرّب بها وبدونها */
function expand(raw) {
  const [pathPart] = raw.split('?');
  const pieces = pathPart.split(HOLE);
  let variants = [pieces[0]];
  for (const next of pieces.slice(1)) {
    variants = variants.flatMap(v => (v.endsWith('/') ? [v + 'x' + next] : [v + next, v + '/x' + next]));
  }
  return variants.map(v => v.replace(/\/+$/, ''));
}

const call = /\bapi\.(get|getBlob|post|postBlob|put|delete)\s*(?:<[^()]*>)?\(\s*(?=[`'"])/g;
const problems = [];
let checked = 0;

for (const file of sources('src/app')) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(call)) {
    const verb = VERBS[match[1]];
    const literal = readLiteral(text, match.index + match[0].length);
    if (!literal.raw.startsWith('/')) continue;   // ليس مسار API
    checked++;
    const line = text.slice(0, match.index).split('\n').length;
    const variants = expand(literal.raw);
    const candidates = operations.filter(o => variants.some(v => o.regex.test(v)));
    const shown = literal.raw.split(HOLE).join('${…}');
    if (candidates.length === 0) problems.push(`${file}:${line}  ${verb} ${shown} — لا نقطة بهذا المسار في العقد`);
    else if (!candidates.some(o => o.verb === verb)) {
      problems.push(`${file}:${line}  ${verb} ${shown} — المسار موجود لكن بـ ${[...new Set(candidates.map(o => o.verb))].join('/')} فقط`);
    }
  }
}

if (problems.length) {
  console.error(`نداءات إلى نقاط غير موجودة في العقد (${problems.length}):\n` + problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`كل نداءات الـ API الثابتة (${checked}) لها نقطة في العقد.`);
