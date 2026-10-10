// صفحات الفروع/الأقسام/المكاتب: منطق النافذة المنبثقة (فتح/إغلاق/إنشاء/تعديل/حذف) → ModalCrud المشترك
import fs from 'node:fs';

const F = 'src/app/features/';
const rd = f => fs.readFileSync(F + f, 'utf8');
const wr = (f, s) => fs.writeFileSync(F + f, s);
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };

function convertTemplate(file, { selectedName, deleteName }) {
  let h = rd(file);
  h = must(h, `${selectedName}()`, 'crud.selected()');
  h = must(h, '(click)="openCreate()"', '(click)="crud.openCreate()"');
  h = must(h, '(click)="openEdit(', '(click)="crud.openEdit(');
  h = must(h, `(click)="${deleteName}(`, '(click)="crud.remove(');
  h = must(h, '@if (activeModal(); as modal)', '@if (crud.activeModal(); as modal)');
  h = must(h, '[heading]="modalTitle(modal)"', '[heading]="crud.modalTitle(modal)"');
  h = must(h, '(closed)="closeModal()"', '(closed)="crud.closeModal()"');
  h = must(h, '(click)="closeModal()"', '(click)="crud.closeModal()"');
  h = must(h, '(ngSubmit)="create()"', '(ngSubmit)="crud.create()"');
  h = must(h, '(ngSubmit)="update()"', '(ngSubmit)="crud.update()"');
  wr(file, h);
}

function convertTs(file, { fieldsRe, methodsRe, insertAfterRe, crudCode, imports, dropImports }) {
  let s = rd(file);
  s = rx(s, fieldsRe, '');
  s = rx(s, methodsRe, '');
  s = rx(s, insertAfterRe, m => m + '\n' + crudCode);
  s = must(s, "import { PageActions } from '@shared/ui/page-actions';", "import { PageActions } from '@shared/ui/page-actions';\n" + imports);
  for (const d of dropImports) s = must(s, d, '');
  s = rx(s, /type ModalType = 'create' \| 'edit';\n\n/, '');
  wr(file, s);
}

// ───────── الفروع ─────────
convertTemplate('branches/pages/branches-page.html', { selectedName: 'selectedBranch', deleteName: 'deleteBranch' });
convertTs('branches/pages/branches-page.ts', {
  fieldsRe: /  selectedBranch = signal<Branch \| null>\(null\);\n  activeModal = signal<ModalType \| null>\(null\);\n/,
  methodsRe: /\n  \/\* =+\n   \* Modal control[\s\S]*?(?=\n\}\s*$)/,
  insertAfterRe: /  canDelete = computed\(\(\) => this\.auth\.hasPermission\(AppPermission\.DeleteBranch\)\);\n/,
  imports: "import { ModalCrud } from '@shared/ui/modal-crud';",
  dropImports: ["import { ToastService } from '@shared/ui/toast.service';\n", "import { ConfirmService } from '@shared/ui/confirm.service';\n"],
  crudCode: `  crud = new ModalCrud({
    actions: this.actions, noun: 'الفرع', plural: 'الفروع',
    titles: { create: 'إنشاء فرع جديد', edit: 'تعديل الفرع' },
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    forms: { create: this.createForm, edit: this.editForm },
    toEditValue: (b: Branch) => ({ name: b.name, description: b.description }),
    toBody: v => { const f = new FormData(); f.append('Name', v.name ?? ''); f.append('Description', v.description ?? ''); return f; },
    service: this.branchService
  });
`
});
// الخاصيتان toast/confirm لم تعودا مستعملتين
let b = rd('branches/pages/branches-page.ts');
b = b.replace('  private toast = inject(ToastService);\n', '').replace('  private confirm = inject(ConfirmService);\n', '');
wr('branches/pages/branches-page.ts', b);

// ───────── الأقسام ─────────
convertTemplate('departments/pages/departments-page.html', { selectedName: 'selectedDepartment', deleteName: 'deleteDepartment' });
convertTs('departments/pages/departments-page.ts', {
  fieldsRe: /  selectedDepartment = signal<Department \| null>\(null\);\n  activeModal = signal<ModalType \| null>\(null\);\n/,
  methodsRe: /\n  \/\* =+\n   \* Modal control[\s\S]*?(?=\n  \/\* =+\n   \* Helpers)/,
  insertAfterRe: /  canDelete = computed\(\(\) => this\.auth\.hasPermission\(AppPermission\.DeleteDepartment\)\);\n/,
  imports: "import { ModalCrud } from '@shared/ui/modal-crud';",
  dropImports: ["import { ToastService } from '@shared/ui/toast.service';\n", "import { ConfirmService } from '@shared/ui/confirm.service';\n"],
  crudCode: `  crud = new ModalCrud({
    actions: this.actions, noun: 'القسم', plural: 'الأقسام',
    titles: { create: 'إنشاء قسم جديد', edit: 'تعديل القسم' },
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    forms: { create: this.createForm, edit: this.editForm },
    toEditValue: (d: Department) => ({ name: d.name, description: d.description, branchId: String(d.branchId) }),
    toBody: v => { const f = new FormData(); f.append('Name', v.name ?? ''); f.append('Description', v.description ?? ''); f.append('BranchId', v.branchId ?? ''); return f; },
    service: this.departmentService
  });
`
});
let d = rd('departments/pages/departments-page.ts');
d = d.replace('  private toast = inject(ToastService);\n', '').replace('  private confirm = inject(ConfirmService);\n', '');
wr('departments/pages/departments-page.ts', d);

// ───────── المكاتب ─────────
convertTemplate('offices/pages/offices-page.html', { selectedName: 'selected', deleteName: 'deleteOffice' });
convertTs('offices/pages/offices-page.ts', {
  fieldsRe: /  selected = signal<Office \| null>\(null\);\n  activeModal = signal<ModalType \| null>\(null\);\n/,
  methodsRe: /\n  \/\* =+\n   \* Modal control[\s\S]*?(?=\n\}\s*$)/,
  insertAfterRe: /  editForm = this\.fb\.group\(\{[\s\S]*?\n  \}\);\n/,
  imports: "import { ModalCrud } from '@shared/ui/modal-crud';",
  dropImports: ["import { ToastService } from '@shared/ui/toast.service';\n", "import { ConfirmService } from '@shared/ui/confirm.service';\n"],
  crudCode: `  crud = new ModalCrud({
    actions: this.actions, noun: 'المكتب', plural: 'المكاتب',
    titles: { create: 'إنشاء مكتب جديد', edit: 'تعديل المكتب' },
    can: { create: computed(() => this.can().create), edit: computed(() => this.can().edit), delete: computed(() => this.can().delete) },
    forms: { create: this.createForm, edit: this.editForm },
    createDefaults: { name: '', description: '', departmentId: '' },
    toEditValue: (o: Office) => ({ name: o.name, description: o.description ?? '', departmentId: String(o.departmentId) }),
    validate: v => (v.name ?? '').trim().length < 2 ? 'أدخل اسماً صحيحاً للمكتب' : null,
    toBody: v => {
      const f = new FormData();
      f.append('Name', (v.name ?? '').trim()); f.append('Description', (v.description ?? '').trim()); f.append('DepartmentId', v.departmentId ?? '');
      return f;
    },
    deleteWarning: 'لا يمكن حذف مكتب مرتبط بموظفين',
    service: this.service
  });
`
});
let o = rd('offices/pages/offices-page.ts');
o = o.replace('  private toast = inject(ToastService);\n', '').replace('  private confirm = inject(ConfirmService);\n', '');
wr('offices/pages/offices-page.ts', o);
console.log('done');
