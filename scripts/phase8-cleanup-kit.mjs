// تنظيف العُدّة بعد CrudPage: errorMessage في ملفه، trackRequest في track-request.ts، وحذف loader() وPageActions غير المستعملين
import fs from 'node:fs';
import path from 'node:path';

const ui = 'src/app/shared/ui/';
fs.writeFileSync(ui + 'error-message.ts', `/** رسالة الخطأ من رد الـ API (apiErrorInterceptor يوحّدها في message) أو نص بديل */
export function errorMessage(error: unknown, fallback: string): string {
  const e = error as { message?: string; error?: { message?: string } } | null;
  return e?.error?.message || e?.message || fallback;
}
`);

fs.writeFileSync(ui + 'track-request.ts', `import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * طلب واحد بنمط الصفحات الموحّد: يرفع مؤشر الانشغال ويصفّر الخطأ، ثم يطفئ المؤشر ويستدعي next عند النجاح،
 * وعند الفشل يطفئ المؤشر ويضع رسالة الخطأ في إشارة الصفحة. (صفحات الإدارة ذات القوائم تستعمل CrudPage)
 */
export function trackRequest<T>(source: Observable<T>, busy: WritableSignal<boolean>, error: WritableSignal<string>, next: (value: T) => void) {
  busy.set(true); error.set('');
  source.subscribe({
    next: value => { busy.set(false); next(value); },
    error: e => { busy.set(false); error.set((e as { message?: string } | null)?.message ?? ''); }
  });
}
`);

// اختبار trackRequest فقط من loader.spec
const spec = fs.readFileSync(ui + 'loader.spec.ts', 'utf8');
const tr = spec.slice(spec.indexOf("describe('trackRequest()'"))
  .replace("    const { signal } = await import('@angular/core');\n    const { trackRequest } = await import('./loader');\n", '');
fs.writeFileSync(ui + 'track-request.spec.ts', `import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { trackRequest } from './track-request';

${tr}`);
for (const f of ['loader.ts', 'loader.spec.ts', 'page-actions.ts']) fs.rmSync(ui + f);

// shared-ui.spec: حذف اختبارات PageActions
let s = fs.readFileSync(ui + 'shared-ui.spec.ts', 'utf8');
s = s.replace("import { PageActions, errorMessage } from '@shared/ui/page-actions';", "import { errorMessage } from '@shared/ui/error-message';");
const a = s.indexOf("describe('PageActions'"), b = s.indexOf("  it('errorMessage falls back");
s = s.slice(0, a) + "describe('errorMessage', () => {\n" + s.slice(b);
fs.writeFileSync(ui + 'shared-ui.spec.ts', s);

// إعادة توجيه الاستيرادات
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []);
let n = 0;
for (const f of walk('src/app')) {
  let c = fs.readFileSync(f, 'utf8'), o = c;
  c = c.split("from '@shared/ui/loader'").join("from '@shared/ui/track-request'");
  c = c.split("from './page-actions'").join("from './error-message'");
  c = c.replace("  /** مفتاح الإجراء الجاري من PageActions ('create' | 'edit' | ...) */", "  /** وضع النافذة الجاري حفظه ('create' | 'edit')، أو null */");
  if (c !== o) { fs.writeFileSync(f, c); n++; }
}
console.log('imports updated in', n, 'files');
