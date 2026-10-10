// الأدوار → CrudPage (شجرة الصلاحيات والنسخ كما هي)
import fs from 'node:fs';

const dir = 'src/app/features/roles/pages/';
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };

let t = fs.readFileSync(dir + 'roles-page.ts', 'utf8');
t = must(t, "import { loader } from '@shared/ui/loader';\n", "import { Alert } from '@shared/ui/alert';\nimport { CrudPage } from '@shared/ui/crud-page';\nimport { RowActions } from '@shared/ui/row-actions';\n");
t = must(t, "import { forkJoin } from 'rxjs';", "import { forkJoin, map } from 'rxjs';");
t = must(t, "import { ToastService } from '@shared/ui/toast.service';\nimport { ConfirmService } from '@shared/ui/confirm.service';\nimport { PageActions } from '@shared/ui/page-actions';\n", '');
t = rx(t, /imports: \[/, 'imports: [Alert, RowActions, ');
t = must(t, '  private toast = inject(ToastService);\n  private confirm = inject(ConfirmService);\n', '');
t = must(t, '  roles = signal<Role[]>([]);\n', '');
t = must(t, '  selectedRole = signal<Role | null>(null);\n  activeModal = signal<ModalType | null>(null);\n  private actions = new PageActions(() => this.load(true));\n  saving = this.actions.saving;\n', '');
t = rx(t, /(  canDelete = computed\(\(\) => this\.auth\.hasPermission\(AppPermission\.DeleteRole\)\);\n)/, `$1
  crud = new CrudPage<Role, FormData>({
    load: () => forkJoin({ roles: this.roleService.getAll(), permissions: this.roleService.getPermissions() })
      .pipe(map(r => { this.permissions.set(r.permissions); return r.roles; })),
    create: body => this.roleService.create(body),
    update: (id, body) => this.roleService.update(id, body),
    remove: role => this.roleService.delete(role.id),
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    onOpen: role => {
      this.collapseAllGroups();
      this.activeSectionKey.set('');
      if (role) this.editForm.reset({ name: role.name, permissionIds: role.permissions?.map(p => p.id) ?? [] });
      else this.createForm.reset({ name: '', permissionIds: [] });
    },
    messages: {
      saved: (_, mode) => mode === 'create' ? 'تم إنشاء الدور بنجاح' : 'تم تعديل الدور بنجاح',
      deleted: 'تم حذف الدور بنجاح', plural: 'الأدوار', confirmLabel: 'تأكيد الحذف',
      confirmDelete: role => \`هل أنت متأكد من حذف الدور "\${role.name}"؟ سيؤثر هذا على المستخدمين المرتبطين به.\`
    }
  });

  roles = this.crud.items;
`);
t = rx(t, /  \/\* =+\n   \* Data loading[\s\S]*?(?=  \/\* =+\n   \* Modal control)/, '');
t = rx(t, /  \/\* =+\n   \* Modal control[\s\S]*?(?=  \/\* =+\n   \* مجموعات الصلاحيات)/, `  /**
   * نسخ دور: نافذة الإنشاء بنفس صلاحيات الدور ووحدته واسم مقترح — لإنشاء دور شخص جديد من دور مشابه
   * ثم تعديل الاسم والوحدة وما يختلف من صلاحيات (قرار المستخدم 2026-10-03: دور لكل شخص).
   */
  openClone(role: Role) {
    this.crud.openCreate();
    if (this.crud.dialog()) this.createForm.reset({ name: \`\${role.name} - نسخة\`, permissionIds: role.permissions?.map(p => p.id) ?? [] });
  }

  modalTitle(type: ModalType): string {
    return type === 'create' ? 'إنشاء دور جديد' : 'تعديل الدور';
  }

`);
t = rx(t, /  \/\* =+\n   \* CRUD actions[\s\S]*?(?=  \/\* =+\n   \* Helpers)/, `  create() {
    if (this.createForm.invalid) return;
    const form = new FormData();
    form.append('Name', this.createForm.value.name ?? '');
    this.appendRole(form, this.createForm);
    this.crud.save(form);
  }

  update() {
    if (this.editForm.invalid) return;
    const form = new FormData();
    form.append('Name', this.editForm.value.name ?? '');
    this.appendRole(form, this.editForm);
    this.crud.save(form);
  }

`);
fs.writeFileSync(dir + 'roles-page.ts', t);

let h = fs.readFileSync(dir + 'roles-page.html', 'utf8');
h = must(h, '(refresh)="load(true)" (create)="openCreate()"', '(refresh)="crud.refresh()" (create)="crud.openCreate()"');
h = must(h, '[loading]="loading()"', '[loading]="crud.busy()"');
h = must(h, '@if (!loading() && roles().length) {', '@if (!crud.loading() && roles().length) {');
h = must(h, '    @if (loading()) {', '    @if (crud.loading()) {');
h = must(h, '[class.selected]="selectedRole()?.id === role.id"', '[class.selected]="crud.dialog()?.item?.id === role.id"');
h = rx(h, /<div class="row-actions">[\s\S]*?<\/div>\s*<\/td>/, `<app-row-actions [canEdit]="canEdit()" [canDelete]="canDelete()" [deleting]="crud.deletingId() === role.id" (edit)="crud.openEdit(role)" (remove)="crud.remove(role)">
                    @if (canCreate()) {
                      <button type="button" class="icon-btn" title="نسخ الدور" [attr.aria-label]="'نسخ الدور ' + role.name" (click)="openClone(role)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="12" height="12" rx="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    }
                  </app-row-actions>
                </td>`);
h = must(h, '@if (activeModal(); as modal) {', '@if (crud.dialog(); as dlg) {');
h = must(h, '[heading]="modalTitle(modal)" size="lg" [busy]="!!saving()" (closed)="closeModal()"', '[heading]="modalTitle(dlg.mode)" size="lg" [busy]="crud.saving()" (closed)="crud.close()"');
h = must(h, '@switch (modal) {', '@switch (dlg.mode) {');
h = h.split('(click)="closeModal()"').join('(click)="crud.close()"');
h = must(h, `[disabled]="createForm.invalid || saving() === 'create'"`, `[disabled]="createForm.invalid || crud.saving()"`);
h = must(h, `@if (saving() === 'create') {`, `@if (crud.saving()) {`);
h = must(h, `[disabled]="editForm.invalid || saving() === 'edit'"`, `[disabled]="editForm.invalid || crud.saving()"`);
h = must(h, `@if (saving() === 'edit') {`, `@if (crud.saving()) {`);
h = must(h, '<form [formGroup]="createForm" (ngSubmit)="create()" class="form-stack">', '<form [formGroup]="createForm" (ngSubmit)="create()" class="form-stack">\n                <app-alert [message]="crud.formError()" />');
h = must(h, '<form [formGroup]="editForm" (ngSubmit)="update()" class="form-stack">', '<form [formGroup]="editForm" (ngSubmit)="update()" class="form-stack">\n                <app-alert [message]="crud.formError()" />');
fs.writeFileSync(dir + 'roles-page.html', h);
console.log('roles converted');
