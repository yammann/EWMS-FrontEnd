// إعدادات الصيانة → CrudPage
import fs from 'node:fs';

const dir = 'src/app/features/maintenance/pages/';
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };

let t = fs.readFileSync(dir + 'settings-page.ts', 'utf8');
t = must(t, "import { ConfirmService } from '@shared/ui/confirm.service';\n", '');
t = must(t, "import { ToastService } from '@shared/ui/toast.service';\n", '');
t = must(t, "import { trackRequest } from '@shared/ui/loader';", "import { CrudPage } from '@shared/ui/crud-page';\nimport { RowActions } from '@shared/ui/row-actions';");
t = must(t, 'StatusChip, Pager],', 'StatusChip, Pager, RowActions],');
t = must(t, '  pager = new Pagination(() => this.items());\n', '');
t = must(t, '  private toast = inject(ToastService);\n  private confirm = inject(ConfirmService);\n', '');
t = must(t, "  items = signal<MaintenanceLookup[]>([]);\n  loading = signal(false);\n  saving = signal(false);\n  error = signal('');\n  formError = signal('');\n  formOpen = signal(false);\n  editing = signal<MaintenanceLookup | null>(null);\n", '');
t = rx(t, /(  stageHint = computed\([^\n]*\n)/, `$1
  crud = new CrudPage<MaintenanceLookup, Partial<MaintenanceLookup>>({
    // التبويب من الرابط: التحميل يبدأ عند قراءة ?tab=
    immediate: false,
    load: () => this.service.lookup(this.kind()),
    create: body => this.service.createLookup(this.kind(), body),
    update: (id, body) => this.service.updateLookup(this.kind(), id, body),
    remove: item => this.service.deleteLookup(this.kind(), item.id),
    can: { create: () => this.can().createLookup, edit: () => this.can().editLookup, delete: () => this.can().deleteLookup },
    onOpen: item => this.form.reset({ name: item?.name ?? '', description: item?.description ?? '', color: item?.color || '#3B82F6', stage: item?.stage ?? 2 }),
    messages: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'القوائم',
      confirmDelete: item => \`حذف «\${item.name}» من \${this.meta().label}؟\`
    }
  });
  pager = new Pagination(() => this.crud.items());
`);
t = must(t, '      this.kind.set(tab && KINDS.includes(tab) ? tab : \'deviceTypes\');\n      this.load();', '      this.kind.set(tab && KINDS.includes(tab) ? tab : \'deviceTypes\');\n      this.crud.reload(true);');
t = rx(t, /\n  load\(\) \{[\s\S]*?\n  \}\n/, '\n');
t = rx(t, /\n  openForm\(item: MaintenanceLookup \| null\) \{[\s\S]*?\n  closeForm\(\) \{[^\n]*\n/, '\n');
t = rx(t, /  save\(\) \{[\s\S]*?\n  \}\n\n  async askDelete[\s\S]*?\n  \}\n/, `  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const meta = this.meta();
    const body: Partial<MaintenanceLookup> = { name: v.name.trim() };
    if (meta.description) body.description = v.description.trim();
    if (meta.color) { body.color = v.color.toUpperCase(); body.stage = v.stage; }
    this.crud.save(body);
  }
`);
fs.writeFileSync(dir + 'settings-page.ts', t);

let h = fs.readFileSync(dir + 'settings-page.html', 'utf8');
h = must(h, '(click)="openForm(null)"', '(click)="crud.openCreate()"');
h = must(h, '<app-alert [message]="error()" />', '<app-alert [message]="crud.loadError()" retryLabel="إعادة المحاولة" (retry)="crud.refresh()" />');
h = must(h, '@if (loading()) {', '@if (crud.loading()) {');
h = rx(h, /<td><div class="row-actions">[\s\S]*?<\/div><\/td>/, '<td><app-row-actions [canEdit]="can().editLookup" [canDelete]="can().deleteLookup" [deleting]="crud.deletingId() === item.id" (edit)="crud.openEdit(item)" (remove)="crud.remove(item)" /></td>');
h = must(h, '@if (formOpen()) {', '@if (crud.dialog(); as dlg) {');
h = must(h, `[heading]="(editing() ? 'تعديل ' : 'إضافة ') + meta().single" [busy]="saving()" (closed)="closeForm()"`, `[heading]="(dlg.mode === 'edit' ? 'تعديل ' : 'إضافة ') + meta().single" [busy]="crud.saving()" (closed)="crud.close()"`);
h = must(h, '<app-alert [message]="formError()" />', '<app-alert [message]="crud.formError()" />');
h = must(h, '<app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closeForm()" />', '<app-form-actions [busy]="crud.saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="crud.close()" />');
fs.writeFileSync(dir + 'settings-page.html', h);
console.log('settings converted; remaining refs:', (h.match(/items\(\)|loading\(\)|error\(\)/g) || []).join(','));
