// بنود التحقق بنمط وينبوكس (app-line-list) في نافذة المهمة الجديدة ونافذة القالب، بدل «بند في كل سطر» داخل textarea
import fs from 'node:fs';

const ed = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + ' missing: ' + a.slice(0, 90));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(f, s);
  console.log('ok', f);
};
const tb = 'src/app/features/task-board/';

ed(tb + 'components/task-form-dialog.ts', [
  ["import { Alert } from '@shared/ui/alert';", "import { Alert } from '@shared/ui/alert';\nimport { LineList, cleanLines } from '@shared/ui/line-list';"],
  ['imports: [Alert, ReactiveFormsModule, FormsModule, Modal]', 'imports: [Alert, LineList, ReactiveFormsModule, FormsModule, Modal]'],
  ["  itemsText = signal('');", "  /** بنود التحقق كما في الحقول (كل بند سطر، بنمط وينبوكس) */\n  items = signal<string[]>(['']);"],
  ["    this.itemsText.set(t.items.join('\\n'));", "    this.items.set(t.items.length ? [...t.items] : ['']);"],
  ["  private items() { return this.itemsText().split('\\n').map(i => i.trim()).filter(Boolean); }", '  private checklist() { return cleanLines(this.items()); }'],
  ['defaultDueDays: due, items: this.items()', 'defaultDueDays: due, items: this.checklist()'],
  ['checklistItems: this.items()', 'checklistItems: this.checklist()']
]);

ed(tb + 'components/task-form-dialog.html', [[
`          <label class="form-field">
            <span class="form-label">بنود التحقق <small class="muted">(اختياري — بند في كل سطر، حتى {{ maxItems }})</small></span>
            <textarea [ngModel]="itemsText()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="itemsText.set($event)" rows="3"
                      placeholder="خطوات صغيرة تُنشأ مع المهمة ويعلّمها المنفِّذ"></textarea>
          </label>`,
`          <div class="form-field">
            <span class="form-label">بنود التحقق <small class="muted">(اختياري — ▼ أو Enter لبند جديد، ▲ للحذف)</small></span>
            <app-line-list [(values)]="items" [max]="maxItems" [disabled]="saving()" label="بند التحقق"
                           placeholder="خطوة صغيرة تُنشأ مع المهمة ويعلّمها المنفِّذ" />
          </div>`]]);

ed(tb + 'pages/recurring-page.ts', [
  ["import { FormActions } from '@shared/ui/form-actions';", "import { FormActions } from '@shared/ui/form-actions';\nimport { LineList, cleanLines } from '@shared/ui/line-list';"],
  ["selector: 'app-template-dialog', standalone: true, imports: [FormActions, Alert, FormsModule, Modal],",
   "selector: 'app-template-dialog', standalone: true, imports: [FormActions, Alert, FormsModule, LineList, Modal],"],
  [`          <label class="form-field"><span class="form-label">بنود التحقق <small class="muted">(بند في كل سطر، حتى 30)</small></span>
            <textarea name="items" rows="5" [(ngModel)]="items" placeholder="جرد الأصناف&#10;مطابقة السجلات&#10;رفع التقرير"></textarea></label>`,
   `          <div class="form-field"><span class="form-label">بنود التحقق <small class="muted">(▼ أو Enter لبند جديد، ▲ للحذف)</small></span>
            <app-line-list [(values)]="items" [max]="30" [disabled]="saving()" label="بند التحقق" placeholder="مثال: جرد الأصناف" /></div>`],
  ["days: number | null = null; items = '';", "days: number | null = null; items: string[] = [''];"],
  ["this.items = t.items.join('\\n'); }", "this.items = t.items.length ? [...t.items] : ['']; }"],
  ["      items: this.items.split('\\n').map(i => i.trim()).filter(Boolean)", '      items: cleanLines(this.items)']
]);
