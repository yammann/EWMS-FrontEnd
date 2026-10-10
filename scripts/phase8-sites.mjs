// صفحة المواقع → CrudPage (نفس النمط الموحّد)
import fs from 'node:fs';

const dir = 'src/app/features/devices/pages/';
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };

let t = fs.readFileSync(dir + 'sites-page.ts', 'utf8');
t = must(t, "import { DeviceService, formatCoords } from '../data-access/device.service';", "import { DeviceService, SiteInput, formatCoords } from '../data-access/device.service';");
t = must(t, "import { ToastService } from '@shared/ui/toast.service';\nimport { ConfirmService } from '@shared/ui/confirm.service';\n", '');
t = must(t, "import { trackRequest } from '@shared/ui/loader';", "import { CrudPage } from '@shared/ui/crud-page';\nimport { RowActions } from '@shared/ui/row-actions';");
t = must(t, 'DeviceHistory, Pager],', 'DeviceHistory, Pager, RowActions],');
t = must(t, '/** المواقع — لكل موقع', '/** المواقع (النمط الموحّد CrudPage) — لكل موقع');
t = must(t, '  pager = new Pagination(() => this.filtered());\n', '');
t = must(t, '  private toast = inject(ToastService);\n  private confirm = inject(ConfirmService);\n', '');
t = must(t, '  sites = signal<Site[]>([]);\n', '');
t = must(t, '  loading = signal(false); saving = signal(false);\n  error = signal(\'\'); formError = signal(\'\');\n  formOpen = signal(false); editing = signal<Site | null>(null);\n', '');
t = must(t, '    return this.sites().filter(', '    return this.crud.items().filter(');
// النموذج أولاً ثم crud
t = rx(t, /(  setCoords\(c: Coordinates\) \{ this\.form\.patchValue\(c\); \}\n)/, `$1
  crud = new CrudPage<Site, SiteInput>({
    load: () => this.service.sites(),
    create: body => this.service.createSite(body),
    // rowVersion كما وصل: يمنع محو تعديل مستخدم آخر بصمت
    update: (id, body, s) => this.service.updateSite(id, { ...body, rowVersion: s.rowVersion }),
    remove: s => this.service.deleteSite(s.id),
    can: { create: () => this.access().canCreate, edit: () => this.access().canEdit, delete: () => this.access().canDelete },
    onOpen: s => this.form.reset({
      name: s?.name ?? '', description: s?.description ?? '', latitude: s?.latitude ?? null, longitude: s?.longitude ?? null,
      contactName: s?.contactName ?? '', contactPhone: s?.contactPhone ?? '', responsibleParty: s?.responsibleParty ?? ''
    }),
    messages: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'المواقع',
      confirmDelete: s => \`حذف الموقع «\${s.name}»؟ لا يمكن حذف موقع فيه تركيبات.\`
    }
  });
  pager = new Pagination(() => this.filtered());
`);
t = must(t, '      .subscribe(p => this.governorate.set(p.get(\'governorate\') ?? \'\'));\n    this.load();\n', '      .subscribe(p => this.governorate.set(p.get(\'governorate\') ?? \'\'));\n');
t = rx(t, /\n  load\(\) \{[\s\S]*?\n  \}\n/, '\n');
t = rx(t, /\n  openForm\(s: Site \| null\) \{[\s\S]*?\n  async askDelete\(s: Site\) \{[\s\S]*?\n  \}\n/, '\n');
t = rx(t, /  save\(\) \{[\s\S]*?\n  \}\n/, `  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.crud.save({
      name: (v.name ?? '').trim(), description: (v.description ?? '').trim(), latitude: v.latitude!, longitude: v.longitude!,
      contactName: (v.contactName ?? '').trim(), contactPhone: normalizePhone(v.contactPhone ?? ''), responsibleParty: (v.responsibleParty ?? '').trim()
    });
  }
`);
t = t.replace(/\n\n\n+/g, '\n\n');
fs.writeFileSync(dir + 'sites-page.ts', t);

let h = fs.readFileSync(dir + 'sites-page.html', 'utf8');
h = must(h, '(click)="openForm(null)"', '(click)="crud.openCreate()"');
h = must(h, '<button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>', '<button class="btn btn-ghost" type="button" (click)="crud.refresh()" [disabled]="crud.busy()">تحديث</button>');
h = must(h, '<app-alert [message]="error()" />', '<app-alert [message]="crud.loadError()" retryLabel="إعادة المحاولة" (retry)="crud.refresh()" />');
h = must(h, '@if (loading()) {', '@if (crud.loading()) {');
h = rx(h, /<td><div class="row-actions">[\s\S]*?<\/div><\/td>/, `<td><app-row-actions [canEdit]="access().canEdit" [canDelete]="access().canDelete" [deleting]="crud.deletingId() === s.id" (edit)="crud.openEdit(s)" (remove)="crud.remove(s)">
                <button class="btn btn-ghost btn-sm" type="button" (click)="history.set(s)">السجل</button>
              </app-row-actions></td>`);
h = must(h, '@if (formOpen()) {', '@if (crud.dialog(); as dlg) {');
h = must(h, `[heading]="editing() ? 'تعديل الموقع' : 'موقع جديد'" size="lg" [busy]="saving()" (closed)="closeForm()"`, `[heading]="dlg.mode === 'edit' ? 'تعديل الموقع' : 'موقع جديد'" size="lg" [busy]="crud.saving()" (closed)="crud.close()"`);
h = must(h, '<app-alert [message]="formError()" />', '<app-alert [message]="crud.formError()" />');
h = must(h, '<app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closeForm()" />', '<app-form-actions [busy]="crud.saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="crud.close()" />');
fs.writeFileSync(dir + 'sites-page.html', h);
console.log('sites converted');
