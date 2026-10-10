// المستخدمون → CrudPage (النموذجان ومنطق المكان كما هما)
import fs from 'node:fs';

const dir = 'src/app/features/users/pages/';
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };

let t = fs.readFileSync(dir + 'users-page.ts', 'utf8');
t = must(t, "import { loader } from '@shared/ui/loader';\n", "import { Alert } from '@shared/ui/alert';\nimport { CrudPage } from '@shared/ui/crud-page';\n");
t = must(t, "import { forkJoin } from 'rxjs';", "import { forkJoin, map } from 'rxjs';");
t = must(t, "import { ToastService } from '@shared/ui/toast.service';\nimport { ConfirmService } from '@shared/ui/confirm.service';\nimport { PageActions } from '@shared/ui/page-actions';\n", '');
t = must(t, "type ModalType = 'create' | 'edit';\n", '');
t = must(t, 'imports: [RowActions,', 'imports: [Alert, RowActions,');
t = must(t, '  private toast = inject(ToastService);\n  private confirm = inject(ConfirmService);\n', '');
t = must(t, '  users = signal<User[]>([]);\n  pager = new Pagination(() => this.users());\n', '');
t = must(t, '  selectedUser = signal<User | null>(null);\n  activeModal = signal<ModalType | null>(null);\n  private actions = new PageActions(() => this.load(true));\n  saving = this.actions.saving;\n', '');
// الرقم الذاتي: مسافات حول القيمة مسموحة (كان \s فقد الشرطة المائلة في تعديل قديم فصار يرفض المسافة)
t = t.split('Validators.pattern(/^s*[A-Za-z0-9-]*s*$/)').join('Validators.pattern(/^\\s*[A-Za-z0-9-]*\\s*$/)');
t = rx(t, /(  canDelete = computed\(\(\) => this\.auth\.hasPermission\(AppPermission\.DeleteUser\)\);\n)/, `$1
  crud = new CrudPage<User, FormData>({
    // المستخدمون + قوائم النموذج (الفروع/الأقسام/المكاتب/الأدوار من التخزين المشترك إن كانت حديثة)
    load: () => forkJoin({
      users: this.userService.getAll(),
      branches: this.lookups.branchOptions(),
      departments: this.lookups.departments(),
      offices: this.lookups.offices(),
      roles: this.lookups.roles()
    }).pipe(map(r => {
      this.branches.set(r.branches); this.departments.set(r.departments); this.offices.set(r.offices); this.roles.set(r.roles);
      return r.users;
    })),
    create: body => this.userService.create(body),
    update: (id, body) => this.userService.update(id, body),
    remove: u => this.userService.delete(u.id),
    can: { create: this.canCreate, edit: this.canEdit, delete: this.canDelete },
    onOpen: user => user ? this.fillEdit(user) : (this.createForm.reset(), this.applyPlacement(this.createForm)),
    onRefresh: () => this.lookups.invalidate(),
    messages: {
      saved: (_, mode) => mode === 'create' ? 'تم إنشاء المستخدم بنجاح' : 'تم تعديل المستخدم بنجاح',
      deleted: 'تم حذف المستخدم بنجاح', plural: 'المستخدمين', confirmLabel: 'تأكيد الحذف',
      confirmDelete: u => \`هل أنت متأكد من حذف المستخدم "\${u.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.\`
    }
  });

  users = this.crud.items;
  pager = new Pagination(() => this.users());
  /** نوع النافذة المفتوحة */
  mode = computed(() => this.crud.dialog()?.mode ?? null);
`);
t = rx(t, /  \/\* =+\n   \* Data loading[\s\S]*?(?=  \/\* =+\n   \* Modal control)/, '');
t = rx(t, /  \/\* =+\n   \* Modal control[\s\S]*?(?=  \/\* =+\n   \* Helpers)/, `  private fillEdit(user: User) {
    this.editForm.patchValue({
      officeId: user.officeId ? String(user.officeId) : '',
      fullName: user.fullName,
      email: user.email,
      personalIdNumber: user.personalIdNumber ?? '',
      phoneNumber: user.phoneNumber ?? '',
      password: '',
      roleId: String(user.roleId),
      departmentId: user.departmentId ? String(user.departmentId) : '',
      branchId: user.branchId ? String(user.branchId) : '',
      isActive: user.isActive
    });
    // تفعيل الحساب وتعطيله بصلاحية منفصلة: من لا يملكها يرى الخيار معطلاً (القيمة ترسل كما هي)
    const toggle = this.editForm.controls.isActive;
    if (this.auth.hasPermission(AppPermission.ToggleUserActive)) toggle.enable(); else toggle.disable();
    this.applyPlacement(this.editForm);
  }

  title() { return this.mode() === 'create' ? 'إنشاء مستخدم جديد' : 'تعديل المستخدم'; }

  create() {
    if (this.createForm.invalid || this.crud.saving() || !this.validAssignment()) return;
    const v = this.createForm.value;
    const form = new FormData();
    form.append('FullName', v.fullName ?? '');
    form.append('Email', v.email ?? '');
    form.append('PersonalIdNumber', (v.personalIdNumber ?? '').trim().toUpperCase());
    form.append('PhoneNumber', normalizePhone(v.phoneNumber));
    form.append('Password', v.password ?? '');
    form.append('RoleId', v.roleId ?? '');
    this.appendPlacement(form, this.createForm);
    this.crud.save(form);
  }

  update() {
    if (this.editForm.invalid || this.crud.saving() || !this.validAssignment()) return;
    const v = this.editForm.value;
    const form = new FormData();
    form.append('FullName', v.fullName ?? '');
    form.append('Email', v.email ?? '');
    form.append('PersonalIdNumber', (v.personalIdNumber ?? '').trim().toUpperCase());
    form.append('PhoneNumber', normalizePhone(v.phoneNumber));
    form.append('RoleId', v.roleId ?? '');
    this.appendPlacement(form, this.editForm);
    form.append('IsActive', String(this.editForm.getRawValue().isActive ?? true));
    // كلمة المرور تُرسَل فقط إن أراد المستخدم تغييرها
    if (v.password) form.append('Password', v.password);
    this.crud.save(form);
  }

`);
t = t.split("this.activeModal() === 'create'").join("this.mode() === 'create'");
t = must(t, "      this.toast.show('تحقق من تبعية القسم للفرع والمكتب للقسم', 'error');", "      this.crud.fail('تحقق من تبعية القسم للفرع والمكتب للقسم');");
fs.writeFileSync(dir + 'users-page.ts', t);

let h = fs.readFileSync(dir + 'users-page.html', 'utf8');
h = must(h, '(refresh)="load(true)" (create)="openCreate()"', '(refresh)="crud.refresh()" (create)="crud.openCreate()"');
h = must(h, '[loading]="loading()"', '[loading]="crud.busy()"');
h = must(h, '@if (loading()) {', '@if (crud.loading()) {');
h = must(h, '[class.selected]="selectedUser()?.id === user.id"', '[class.selected]="crud.dialog()?.item?.id === user.id"');
h = must(h, `[deleting]="saving() === 'delete-' + user.id" (edit)="openEdit(user)" (remove)="deleteUser(user)"`, `[deleting]="crud.deletingId() === user.id" (edit)="crud.openEdit(user)" (remove)="crud.remove(user)"`);
h = must(h, '@if (activeModal(); as modal) {', '@if (crud.dialog(); as dlg) {');
h = must(h, '[heading]="modalTitle(modal)" size="lg" [busy]="!!saving()" (closed)="closeModal()"', '[heading]="title()" size="lg" [busy]="crud.saving()" (closed)="crud.close()"');
h = h.split('(click)="closeModal()"').join('(click)="crud.close()"');
h = must(h, `[disabled]="createForm.invalid || saving() === 'create'"`, `[disabled]="createForm.invalid || crud.saving()"`);
h = must(h, `@if (saving() === 'create') {`, `@if (crud.saving()) {`);
h = must(h, `[disabled]="editForm.invalid || saving() === 'edit'"`, `[disabled]="editForm.invalid || crud.saving()"`);
h = must(h, `@if (saving() === 'edit') {`, `@if (crud.saving()) {`);
h = must(h, '<form [formGroup]="createForm" (ngSubmit)="create()" class="form-stack">', '<form [formGroup]="createForm" (ngSubmit)="create()" class="form-stack">\n                <app-alert [message]="crud.formError()" />');
h = must(h, '<form [formGroup]="editForm" (ngSubmit)="update()" class="form-stack">', '<form [formGroup]="editForm" (ngSubmit)="update()" class="form-stack">\n                <app-alert [message]="crud.formError()" />');
h = h.replace(/@switch \(modal\)/, '@switch (dlg.mode)');
fs.writeFileSync(dir + 'users-page.html', h);
console.log('users converted; leftover modal refs:', (h.match(/\bmodal\b(?!-)/g) || []).length);
