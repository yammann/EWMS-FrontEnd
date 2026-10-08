// يقسّم EwmsService إلى خدمات الميزات (CRUD) + LookupsService للقراءة المخزّنة، ويحدّث الصفحات المستهلكة
import fs from 'node:fs';
import path from 'node:path';

const F = 'src/app/features';
const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(F, f)), { recursive: true }); fs.writeFileSync(path.join(F, f), s); };

const crud = ({ cls, model, base, lookupKinds, listLabel, extra = '' }) => `import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { LookupsService } from '@core/services/lookups.service';
import { ${model} } from '@core/models/ewms.models';

/** ${listLabel} — القراءة المخزّنة من LookupsService، والتعديلات تُبطل التخزين */
@Injectable({ providedIn: 'root' })
export class ${cls} {
  private api = inject(ApiService);
  private lookups = inject(LookupsService);

  /** force = true يتجاوز التخزين المؤقت (زر «تحديث») */
  getAll(force = false) { return this.lookups.${lookupKinds}(force); }
  create(form: FormData) { return this.api.post<${model}>('${base}/Create', form).pipe(tap(() => this.lookups.invalidate())); }
  update(id: number, form: FormData) { return this.api.put<${model}>(\`${base}/Update/\${id}\`, form).pipe(tap(() => this.lookups.invalidate())); }
  delete(id: number) { return this.api.delete<{ message: string }>(\`${base}/Delete/\${id}\`).pipe(tap(() => this.lookups.invalidate())); }${extra}
}
`;

w('branches/data-access/branch.service.ts', crud({ cls: 'BranchService', model: 'Branch', base: '/Branches', lookupKinds: 'branches', listLabel: 'الفروع' }));
w('departments/data-access/department.service.ts', crud({ cls: 'DepartmentService', model: 'Department', base: '/Department', lookupKinds: 'departments', listLabel: 'الأقسام' }));
w('offices/data-access/office.service.ts', crud({ cls: 'OfficeService', model: 'Office', base: '/Offices', lookupKinds: 'offices', listLabel: 'المكاتب' }));
w('roles/data-access/role.service.ts', crud({
  cls: 'RoleService', model: 'Role', base: '/Roles', lookupKinds: 'roles', listLabel: 'الأدوار',
  extra: `
  getPermissions() { return this.api.get<Role['permissions']>('/Roles/Permissions'); }`
}));

w('users/data-access/user.service.ts', `import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { User } from '@core/models/ewms.models';

/** المستخدمون (لا تُخزَّن مؤقتاً: تتغير كثيراً وتُقرأ بصلاحيات ونطاق مختلف) */
@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  getAll() { return this.api.get<User[]>('/Users/GetAll'); }
  getByBranch(branchId: number) { return this.api.get<User[]>(\`/Users/Branch/\${branchId}\`); }
  create(form: FormData) { return this.api.post<User>('/Users/Create', form); }
  update(id: number, form: FormData) { return this.api.put<User>(\`/Users/Update/\${id}\`, form); }
  delete(id: number) { return this.api.delete<{ message: string }>(\`/Users/Delete/\${id}\`); }
}
`);

console.log('services generated');
