// يزيل أزرار الرجوع المحلية ويستبدلها بالزر الموحّد (app-back-button)
import fs from 'node:fs';

const base = 'src/app/features/';
const edit = (f, fn) => { const p = base + f; const s = fs.readFileSync(p, 'utf8'); const o = fn(s); if (o === s) throw new Error('no change ' + f); fs.writeFileSync(p, o); };
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 50)); return s.replace(a, () => b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };
const addImport = (s, line, cls) => {
  s = s.replace(/^(import [^\n]*\n)(?!import)/m, `$1${line}\n`);
  return rx(s, /imports: \[/, `imports: [${cls}, `);
};

// صفحتا التفاصيل (داخل التخطيط): الزر في الشريط العلوي → نحذف الزر المحلي
edit('devices/site-details-page.ts', s => {
  s = must(s, '          <button class="btn btn-ghost" type="button" (click)="goBack()">→ رجوع</button>\n', '');
  s = rx(s, /\n  \/\*\* الرجوع للصفحة السابقة[^\n]*\n  goBack\(\) \{[\s\S]*?\n  \}\n/, '\n');
  s = must(s, "import { Location } from '@angular/common';\n", '');
  s = must(s, '  private location = inject(Location);\n', '');
  return s;
});
edit('maintenance/request-details-page.ts', s => {
  s = must(s, '          <button class="btn btn-ghost" type="button" (click)="goBack()">→ رجوع</button>\n', '');
  s = rx(s, /\n  goBack\(\) \{[\s\S]*?\n  \}\n/, '\n');
  s = must(s, "import { DatePipe, Location } from '@angular/common';", "import { DatePipe } from '@angular/common';");
  s = must(s, '  private location = inject(Location);\n', '');
  return s;
});
// صفحتا الطباعة (خارج التخطيط): الزر الموحّد أول عنصر في الشريط
edit('maintenance/request-print-page.ts', s => {
  s = must(s, '<button type="button" class="btn btn-ghost" (click)="goBack()">→ رجوع</button>', `<app-back-button [fallback]="backUrl" />`);
  s = rx(s, /\n  goBack\(\) \{[\s\S]*?\n  \}\n/, '\n');
  s = must(s, '  private location = inject(Location);', "  /** وجهة الرجوع إن فُتحت الورقة برابط مباشر: صفحة الطلب نفسه */\n  backUrl = '/maintenance/requests/' + this.route.snapshot.paramMap.get('id');\n  private location = inject(Location);");
  return addImport(s, "import { BackButton } from '@shared/ui/back-button';", 'BackButton');
});
edit('vacations/vacation-print-page.ts', s => {
  s = must(s, '<button type="button" class="btn btn-ghost" (click)="goBack()">→ رجوع</button>', '<app-back-button />');
  s = rx(s, /\n  goBack\(\) \{[\s\S]*?\n  \}\n/, '\n');
  s = must(s, "import { DatePipe, Location } from '@angular/common';", "import { DatePipe } from '@angular/common';");
  s = must(s, '  private location = inject(Location);\n', '');
  return addImport(s, "import { BackButton } from '@shared/ui/back-button';", 'BackButton');
});
// مفكرتي: رابط ‹ مفكرتي ورابط الخطأ
edit('todo/todo-list-page.ts', s => {
  s = must(s, '              <a class="t-back" routerLink="/todo-lists">‹ مفكرتي</a>\n', '');
  s = must(s, '<p class="alert alert-error" role="alert">{{ error() }}</p><a class="btn btn-ghost" routerLink="/todo-lists">رجوع إلى مفكرتي</a>', '<p class="alert alert-error" role="alert">{{ error() }}</p>');
  return s;
});
edit('todo/todo.scss', s => rx(s, /\.t-back \{[^\n]*\}\n/, ''));
console.log('done');
