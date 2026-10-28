// يولّد أنواع TypeScript لنماذج الـ API من لقطة العقد contract/openapi.json (نسخة من الباكاند، انظر contract-sync.mjs).
//   node scripts/api-types.mjs          يكتب src/app/core/api/api-types.ts
//   node scripts/api-types.mjs --check  يفشل إن كان الملف المحفوظ لا يطابق ما يُولَّد الآن (بوابة CI)
// المولّد صغير عمداً (وثيقة Swashbuckle بسيطة: كائنات ومصفوفات ومراجع وnullable) فلا حاجة لحزمة تفرض TypeScript 5.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const SOURCE = 'contract/openapi.json';
const TARGET = 'src/app/core/api/api-types.ts';

function typeOf(schema) {
  if (!schema) return 'unknown';
  if (schema.$ref) return schema.$ref.split('/').pop();
  let base;
  switch (schema.type) {
    case 'integer':
    case 'number': base = 'number'; break;
    case 'boolean': base = 'boolean'; break;
    case 'string': base = 'string'; break;   // date-time وuuid وbyte (Base64) نصوص في JSON
    case 'array': base = `${wrap(typeOf(schema.items))}[]`; break;
    case 'object':
      base = schema.properties ? inline(schema) : (schema.additionalProperties && schema.additionalProperties !== true
        ? `Record<string, ${typeOf(schema.additionalProperties)}>` : 'Record<string, unknown>');
      break;
    default: base = 'unknown';
  }
  return schema.nullable ? `${base} | null` : base;
}

const wrap = (t) => (t.includes(' | ') ? `(${t})` : t);

function inline(schema) {
  const body = Object.entries(schema.properties).map(([k, v]) => `${k}: ${typeOf(v)}`).join('; ');
  return `{ ${body} }`;
}

function render(doc) {
  const schemas = doc.components?.schemas ?? {};
  const lines = [
    '// ملف مولَّد من contract/openapi.json بالأمر `npm run api:types` — لا تعدّله يدوياً.',
    '// شكل ما يرسله الخادم (الحقل بلا `| null` يُرسَل دائماً). عند تغيّر العقد يتغيّر هذا الملف في الـ commit نفسه فيراجعه إنسان.',
    ''
  ];
  for (const name of Object.keys(schemas).sort()) {
    const schema = schemas[name];
    if (schema.type === 'object' || schema.properties) {
      const props = Object.entries(schema.properties ?? {}).sort(([a], [b]) => a.localeCompare(b, 'en'));
      lines.push(`export interface ${name} {`);
      for (const [key, value] of props) lines.push(`  ${key}: ${typeOf(value)};`);
      lines.push('}', '');
    } else {
      lines.push(`export type ${name} = ${typeOf(schema)};`, '');
    }
  }
  return lines.join('\n');
}

if (!existsSync(SOURCE)) {
  console.error(`لا يوجد ${SOURCE}. شغّل: npm run contract:sync`);
  process.exit(1);
}

const output = render(JSON.parse(readFileSync(SOURCE, 'utf8')));

if (process.argv.includes('--check')) {
  const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== output) {
    console.error(`${TARGET} لا يطابق ${SOURCE}. شغّل: npm run api:types ثم أرفق الملف بالـ commit.`);
    process.exit(1);
  }
  console.log('أنواع الـ API محدّثة.');
} else {
  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, output);
  console.log(`كُتب ${TARGET}`);
}
