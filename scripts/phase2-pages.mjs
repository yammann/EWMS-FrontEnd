// صفحات الإدارة: من EwmsService + subscribe يدوي إلى خدمات الميزات + LookupsService + loader()
import fs from 'node:fs';

const F = 'src/app/features/';
const edit = (f, fn) => { const p = F + f; const s = fs.readFileSync(p, 'utf8'); const o = fn(s); if (o === s) throw new Error('no change ' + f); fs.writeFileSync(p, o); };
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); return s.split(a).join(b); };
const rx = (s, re, b) => { if (!re.test(s)) throw new Error('missing re: ' + re); return s.replace(re, b); };
const addImport = (s, line) => s.replace(/^(import [^\n]*\n)/m, `$1${line}\n`);

// ───────── الفروع ─────────
edit('branches/pages/branches-page.ts', s => {
  s = must(s, "import { EwmsService } from '@core/services/ewms.service';", "import { BranchService } from '../data-access/branch.service';");
  s = addImport(s, "import { loader } from '@shared/ui/loader';");
  s = must(s, 'private ewms = inject(EwmsService);', 'private branchService = inject(BranchService);');
  s = must(s, '  loading = signal(true);\n  private actions = new PageActions(() => this.load());', '  private actions = new PageActions(() => this.load(true));');
  s = rx(s, /  constructor\(\) \{\n    this\.load\(\);\n  \}\n\n/, '');
  s = rx(s, /  load\(\) \{\n    this\.loading\.set\(true\);\n    this\.ewms\.getBranches\(\)\.subscribe\(\{[\s\S]*?\n    \}\);\n  \}\n/,
`  private force = false;
  private data = loader(() => this.branchService.getAll(this.force), [] as Branch[], {
    onLoaded: branches => this.branches.set(branches),
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }
`);
  s = must(s, 'this.ewms.createBranch(', 'this.branchService.create(');
  s = must(s, 'this.ewms.updateBranch(', 'this.branchService.update(');
  s = must(s, 'this.ewms.deleteBranch(', 'this.branchService.delete(');
  return s;
});

// ───────── الأقسام ─────────
edit('departments/pages/departments-page.ts', s => {
  s = must(s, "import { EwmsService } from '@core/services/ewms.service';", "import { DepartmentService } from '../data-access/department.service';\nimport { LookupsService } from '@core/services/lookups.service';");
  s = addImport(s, "import { loader } from '@shared/ui/loader';");
  s = must(s, 'private ewms = inject(EwmsService);', 'private departmentService = inject(DepartmentService);\n  private lookups = inject(LookupsService);');
  s = rx(s, /  loading = signal\(true\);\n/, '');
  s = must(s, 'new PageActions(() => this.load())', 'new PageActions(() => this.load(true))');
  s = rx(s, /  load\(\) \{\n    this\.loading\.set\(true\);\n    forkJoin\(\{\n      departments: this\.ewms\.getDepartments\(\),\n      branches: this\.ewms\.getBranchLookup\(\)\n    \}\)\.subscribe\(\{[\s\S]*?\n    \}\);\n  \}\n/,
`  private force = false;
  private data = loader(() => forkJoin({
    departments: this.departmentService.getAll(this.force),
    branches: this.lookups.branchOptions(this.force)
  }), null, {
    onLoaded: result => { if (result) { this.departments.set(result.departments); this.branches.set(result.branches); } },
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }
`);
  s = rx(s, /\n  constructor\(\) \{\n    this\.load\(\);\n  \}\n/, '\n');
  s = must(s, 'this.ewms.createDepartment(', 'this.departmentService.create(');
  s = must(s, 'this.ewms.updateDepartment(', 'this.departmentService.update(');
  s = must(s, 'this.ewms.deleteDepartment(', 'this.departmentService.delete(');
  return s;
});

// ───────── المكاتب ─────────
edit('offices/pages/offices-page.ts', s => {
  s = must(s, "import { EwmsService } from '@core/services/ewms.service';", "import { OfficeService } from '../data-access/office.service';\nimport { LookupsService } from '@core/services/lookups.service';");
  s = addImport(s, "import { loader } from '@shared/ui/loader';");
  s = must(s, 'private service = inject(EwmsService);', 'private service = inject(OfficeService);\n  private lookups = inject(LookupsService);');
  s = rx(s, /  constructor\(\) \{ this\.load\(\); \}\n\n/, '');
  s = rx(s, /  load\(\) \{\n    this\.loading\.set\(true\);\n    forkJoin\(\{ offices: this\.service\.getOffices\(\), departments: this\.service\.getDepartments\(\) \}\)\.subscribe\(\{[\s\S]*?\n    \}\);\n  \}\n/,
`  private force = false;
  private data = loader(() => forkJoin({ offices: this.service.getAll(this.force), departments: this.lookups.departments(this.force) }), null, {
    onLoaded: r => { if (r) { this.items.set(r.offices); this.departments.set(r.departments); } },
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }
`);
  s = must(s, 'this.service.createOffice(', 'this.service.create(');
  s = must(s, 'this.service.updateOffice(', 'this.service.update(');
  s = must(s, 'this.service.deleteOffice(', 'this.service.delete(');
  return s;
});

// ───────── المستخدمون ─────────
edit('users/pages/users-page.ts', s => {
  s = must(s, "import { EwmsService } from '@core/services/ewms.service';", "import { UserService } from '../data-access/user.service';\nimport { LookupsService } from '@core/services/lookups.service';");
  s = addImport(s, "import { loader } from '@shared/ui/loader';");
  s = must(s, 'private ewms = inject(EwmsService);', 'private userService = inject(UserService);\n  private lookups = inject(LookupsService);');
  s = rx(s, /  load\(\) \{\n    this\.loading\.set\(true\);\n    forkJoin\(\{[\s\S]*?\n    \}\);\n  \}\n/,
`  private force = false;
  private data = loader(() => forkJoin({
    users: this.userService.getAll(),
    branches: this.lookups.branchOptions(this.force),
    departments: this.lookups.departments(this.force),
    offices: this.lookups.offices(this.force),
    roles: this.lookups.roles(this.force)
  }), null, {
    onLoaded: result => {
      if (!result) return;
      this.users.set(result.users);
      this.branches.set(result.branches);
      this.departments.set(result.departments);
      this.offices.set(result.offices);
      this.roles.set(result.roles);
    },
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }
`);
  s = must(s, 'this.ewms.createUser(', 'this.userService.create(');
  s = must(s, 'this.ewms.updateUser(', 'this.userService.update(');
  s = must(s, 'this.ewms.deleteUser(', 'this.userService.delete(');
  return s;
});

// ───────── الأدوار ─────────
edit('roles/pages/roles-page.ts', s => {
  s = must(s, "import { EwmsService } from '@core/services/ewms.service';", "import { RoleService } from '../data-access/role.service';");
  s = addImport(s, "import { loader } from '@shared/ui/loader';");
  s = must(s, 'private ewms = inject(EwmsService);', 'private roleService = inject(RoleService);');
  s = rx(s, /  load\(\) \{\n    this\.loading\.set\(true\);\n    forkJoin\(\{\n      roles: this\.ewms\.getRoles\(\), permissions: this\.ewms\.getPermissions\(\),\n    \}\)\.subscribe\(\{[\s\S]*?\n    \}\);\n  \}\n/,
`  private force = false;
  private data = loader(() => forkJoin({ roles: this.roleService.getAll(this.force), permissions: this.roleService.getPermissions() }), null, {
    onLoaded: result => { if (result) { this.roles.set(result.roles); this.permissions.set(result.permissions); } },
    onError: error => this.actions.loadFailed(error)
  });
  loading = this.data.loading;

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث» وبعد أي تعديل) */
  load(force = false) { this.force = force; this.data.reload(); }
`);
  s = must(s, 'this.ewms.createRole(', 'this.roleService.create(');
  s = must(s, 'this.ewms.updateRole(', 'this.roleService.update(');
  s = must(s, 'this.ewms.deleteRole(', 'this.roleService.delete(');
  return s;
});
console.log('pages updated');
