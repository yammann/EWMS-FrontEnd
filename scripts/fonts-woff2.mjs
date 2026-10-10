// يحوّل خطوط public/fonts/*.otf إلى WOFF2 (ضغط بلا فقد). تشغيل: npm run fonts:woff2
// التحقق: فكّ الضغط ثم مقارنة كل جدول من جداول الخط (أشكال الحروف CFF، الأبعاد، قواعد الوصل GSUB/GPOS…) بالأصل.
// (WOFF2 لا يحفظ ترتيب الجداول والحشو بايتاً ببايت حسب المواصفة، لذلك المقارنة على مستوى محتوى الجداول.)
import fs from 'node:fs';
import path from 'node:path';
import wawoff2 from 'wawoff2';

function tables(buf) {
  const n = buf.readUInt16BE(4), map = new Map();
  for (let i = 0; i < n; i++) {
    const e = 12 + i * 16;
    const tag = buf.toString('latin1', e, e + 4), off = buf.readUInt32BE(e + 8), len = buf.readUInt32BE(e + 12);
    const data = Buffer.from(buf.subarray(off, off + len));
    // head: checkSumAdjustment يُعاد حسابه، وبت flags رقم 11 («حُوِّل بلا فقد») يضبطه مُرمّز WOFF2 إلزامياً — بيانات وصفية لا تؤثر على العرض
    if (tag === 'head') { data.fill(0, 8, 12); data[16] &= ~0x08; }
    map.set(tag, data);
  }
  return map;
}

const dir = path.resolve('public/fonts');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.otf'))) {
  const src = fs.readFileSync(path.join(dir, f));
  const out = Buffer.from(await wawoff2.compress(src));
  const a = tables(src), b = tables(Buffer.from(await wawoff2.decompress(out)));
  // DSIG (توقيع رقمي فارغ، لا أثر له على العرض) يُسقطه WOFF2 حسب المواصفة؛ كل ما عداه يجب أن يطابق
  a.delete('DSIG');
  if (a.size !== b.size) throw new Error(`${f}: عدد الجداول ${a.size} ≠ ${b.size}`);
  for (const [tag, data] of a) if (!b.get(tag)?.equals(data)) throw new Error(`${f}: الجدول ${tag} تغيّر`);
  fs.writeFileSync(path.join(dir, f.replace(/\.otf$/, '.woff2')), out);
  console.log(`${f}: ${src.length} → ${out.length} bytes (${Math.round(100 - out.length / src.length * 100)}% أصغر) — ${a.size} جدولاً مطابقة: ${[...a.keys()].join(' ')}`);
}
