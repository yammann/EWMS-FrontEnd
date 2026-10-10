// نوافذ الفروع/الأقسام/المكاتب: نسختا الإنشاء والتعديل → app-entity-form واحد
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/app/features');
const PAGES = {
  branches: { noun: 'الفرع', label: 'اسم الفرع', create: 'إنشاء الفرع', extra: '' },
  departments: {
    noun: 'القسم', label: 'اسم القسم', create: 'إنشاء القسم',
    extra: `
          <ng-container [formGroup]="modal === 'create' ? createForm : editForm">
            <div class="form-field">
              <label class="form-label" [attr.for]="modal + '-branch'">الفرع</label>
              <select [id]="modal + '-branch'" formControlName="branchId">
                <option value="">اختر الفرع</option>
                @for (branch of branches(); track branch.id) {
                  <option [value]="branch.id">{{ branch.name }}</option>
                }
              </select>
              @if (modal === 'create' && createForm.controls.branchId.touched && createForm.controls.branchId.invalid) {
                <small class="form-error">اختر الفرع المرتبط بالقسم.</small>
              }
            </div>
          </ng-container>`
  },
  offices: {
    noun: 'المكتب', label: 'اسم المكتب', create: 'إنشاء المكتب', maxlength: 500,
    extra: `
          <ng-container ngProjectAs="[before]" [formGroup]="modal === 'create' ? createForm : editForm">
            <div class="form-field">
              <label class="form-label" [attr.for]="modal + '-dept'">القسم</label>
              <select [id]="modal + '-dept'" formControlName="departmentId">
                <option value="">اختر القسم</option>
                @for (department of departments(); track department.id) {
                  <option [value]="department.id">{{ department.branchName }} / {{ department.name }}</option>
                }
              </select>
              @if (modal === 'create' && createForm.controls.departmentId.touched && createForm.controls.departmentId.invalid) {
                <small class="form-error">اختر القسم التابع له المكتب.</small>
              }
            </div>
          </ng-container>`
  }
};

for (const [feat, p] of Object.entries(PAGES)) {
  const f = path.join(root, feat, 'pages', `${feat}-page.html`);
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('<app-entity-form')) continue;               // سبق تحويلها
  // أيقونة حقل الاسم من نسخة الإنشاء الحالية + placeholders (المكاتب بلا أيقونة وباسم محدود بـ 100)
  const plain = feat === 'offices';
  const iconM = plain
    ? [null, '', /id="create-name"[^>]*?placeholder="([^"]+)"/.exec(s)?.[1]]
    : /<div class="input-wrapper">\s*(<svg[\s\S]*?<\/svg>)\s*<input id="create-name"[^>]*?placeholder="([^"]+)"/.exec(s);
  const descM = /<textarea id="create-desc"[^>]*?placeholder="([^"]+)"/.exec(s);
  if (!iconM || !descM) throw new Error('parse ' + feat);
  const icon = plain ? '' : iconM[1].replace(/<svg /, '<svg nameIcon ').replace(/\n\s+/g, '\n            ');
  if (plain) p.extraAttrs = ' [iconed]="false" [nameMaxLength]="100"';
  const body = `<div class="modal-body">
          <app-entity-form [mode]="modal" [form]="modal === 'create' ? createForm : editForm" nameLabel="${p.label}"
                           namePlaceholder="${iconM[2]}" descPlaceholder="${descM[1]}" createLabel="${p.create}"${p.extraAttrs ?? ''}${p.maxlength ? ` [descMaxLength]="${p.maxlength}"` : ''}
                           [saving]="saving()" (submitted)="modal === 'create' ? crud.create() : crud.update()" (dismissed)="crud.closeModal()">
            ${icon}${p.extra}
          </app-entity-form>
        </div>
    </app-modal>`;
  const re = /<div class="modal-body">[\s\S]*<\/div>\s*<\/app-modal>/;
  if (!re.test(s)) throw new Error('region ' + feat);
  s = s.replace(re, () => body);
  fs.writeFileSync(f, s);
  const tsf = path.join(root, feat, 'pages', `${feat}-page.ts`);
  let t = fs.readFileSync(tsf, 'utf8');
  t = t.replace(/^(import [^\n]*\n)/m, `$1import { EntityForm } from '@shared/ui/entity-form';\n`).replace(/imports:\s*\[/, 'imports: [EntityForm, ');
  fs.writeFileSync(tsf, t);
}
console.log('converted');
