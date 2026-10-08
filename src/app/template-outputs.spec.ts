import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * حارس ربط المخرجات: ربط (event) على مكوّن مخصّص لا يملك هذا المخرج يُترجَم بصمت إلى مستمع DOM بلا أي خطأ بناء
 * (حدث هذا فعلاً بعد إعادة تسمية close → closed). هذا الاختبار يطابق كل `<app-x (event)=…>` مع مخرجات المكوّن.
 */
const root = join(process.cwd(), 'src/app');
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(root).filter(f => /\.(ts|html)$/.test(f) && !f.endsWith('.spec.ts'));
const read = (f: string) => readFileSync(f, 'utf8');

// أحداث DOM المسموحة على عناصر app-* (تُربط مباشرة على العنصر المضيف)
const DOM_EVENTS = new Set(['click', 'dblclick', 'keydown', 'keyup', 'keydown.enter', 'keydown.escape', 'keyup.enter', 'keydown.esc', 'focus', 'blur', 'mouseenter', 'mouseleave', 'contextmenu', 'scroll', 'pointerdown', 'dragover', 'drop']);

describe('template output bindings', () => {
  const outputs = new Map<string, Set<string>>();   // selector → مخرجاته
  for (const f of files.filter(x => x.endsWith('.ts'))) {
    const src = read(f);
    for (const chunk of src.split(/(?=@Component\()/).slice(1)) {
      const sel = /selector:\s*'([^']+)'/.exec(chunk)?.[1];
      if (!sel) continue;
      const set = new Set<string>();
      for (const m of chunk.matchAll(/\b(\w+)\s*=\s*output(?:<[^>]*>)?\(/g)) set.add(m[1]);
      for (const m of chunk.matchAll(/@Output\(\)\s+(\w+)/g)) set.add(m[1]);
      for (const m of chunk.matchAll(/\b(\w+)\s*=\s*model(?:\.required)?(?:<[^>]*>)?\(/g)) set.add(m[1] + 'Change');
      outputs.set(sel, set);
    }
  }

  it('has discovered the app components', () => expect(outputs.size).toBeGreaterThan(30));

  it('binds only outputs that exist on custom elements', () => {
    const problems: string[] = [];
    for (const f of files) {
      const src = read(f);
      for (const tag of src.matchAll(/<(app-[\w-]+)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
        const known = outputs.get(tag[1]);
        if (!known) continue;
        for (const ev of tag[2].matchAll(/\(([\w.]+)\)\s*=/g)) {
          if (!known.has(ev[1]) && !DOM_EVENTS.has(ev[1])) problems.push(`${f.replace(root, '')}: <${tag[1]} (${ev[1]})> — المخرجات: ${[...known].join(', ') || 'لا شيء'}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
