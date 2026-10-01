import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { EwmsService } from '../../core/services/ewms.service';
import { AppModule, ModuleService, ModuleUnit, ModuleUnitType } from '../../core/services/module.service';
import { AppPermission } from '../../core/constants/access';
import { Branch, Department, Office } from '../../core/models/ewms.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';

const TYPE_LABEL: Record<ModuleUnitType, string> = { Organization: 'عام', Branch: 'فرع', Department: 'قسم', Office: 'مكتب' };

/**
 * إسناد الخدمات: كل خدمة (الصيانة، توثيق الأجهزة...) تُسند إلى الفرع أو القسم أو المكتب الذي يملكها،
 * فتظهر لموظفي تلك الوحدة ورئيسها، ويطّلع عليها رئيس فرعها تلقائياً. الخدمة قد تُسند لأكثر من وحدة.
 */
@Component({
  selector: 'app-modules-page', standalone: true,
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">الإدارة</span><h1>إسناد الخدمات</h1>
          <p class="muted">حدّد لكل خدمة من يستخدمها: كل المؤسسة، أو الوحدات التنظيمية التي تملكها. موظفو الوحدة يستخدمونها حسب أدوارهم، ورئيس فرعها يطّلع عليها تلقائياً.</p></div>
        <div class="header-actions"><button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading() || !!saving()">تحديث</button></div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (loading() && !modules().length) { <div class="panel empty-state" role="status">جارٍ التحميل…</div> }

      @for (m of modules(); track m.key) {
        <section class="panel">
          <div class="panel-heading">
            <div><h2>{{ m.name }}</h2><p>{{ m.description }}</p></div>
            <span class="count">{{ m.units.length ? m.units.length + ' وحدة' : 'غير مُسندة' }}</span>
          </div>

          @if (m.units.length) {
            <ul class="units" role="list">
              @for (u of m.units; track u.type + u.id) {
                <li class="unit">
                  <span class="type t-{{ u.type }}">{{ typeLabel[u.type] }}</span>
                  <span class="name"><strong>{{ u.name }}</strong>@if (u.path) { <small>{{ u.path }}</small> }</span>
                  @if (canEdit()) {
                    <button type="button" class="remove" (click)="remove(m, u)" [disabled]="!!saving()" [attr.aria-label]="'إلغاء إسناد ' + m.name + ' عن ' + u.name" title="إلغاء الإسناد">×</button>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="unassigned">هذه الخدمة غير مُسندة لأي وحدة — لا تظهر لأحد غير مدير النظام حتى تُسند.</p>
          }

          @if (m.units.length > 1 && has(m, 'Organization', 0)) {
            <p class="hint-line">الخدمة مُسندة لكل المؤسسة، فالوحدات الأخرى في القائمة لا تضيف شيئاً.</p>
          }

          @if (canEdit()) {
            <div class="add">
              <select #pick aria-label="الوحدة" [disabled]="!!saving()">
                <option value="">اختر وحدة لإسناد الخدمة إليها…</option>
                <option value="Organization:0" [disabled]="has(m, 'Organization', 0)">كل المؤسسة</option>
                <optgroup label="الفروع">
                  @for (b of branches(); track b.id) { <option [value]="'Branch:' + b.id" [disabled]="has(m, 'Branch', b.id)">{{ b.name }}</option> }
                </optgroup>
                <optgroup label="الأقسام">
                  @for (d of departments(); track d.id) { <option [value]="'Department:' + d.id" [disabled]="has(m, 'Department', d.id)">{{ d.branchName }} / {{ d.name }}</option> }
                </optgroup>
                <optgroup label="المكاتب">
                  @for (o of offices(); track o.id) { <option [value]="'Office:' + o.id" [disabled]="has(m, 'Office', o.id)">{{ o.branchName }} / {{ o.departmentName }} / {{ o.name }}</option> }
                </optgroup>
              </select>
              <button type="button" class="btn" (click)="add(m, pick.value); pick.value = ''" [disabled]="!!saving()">{{ saving() === m.key ? 'جارٍ الحفظ…' : 'إسناد' }}</button>
            </div>
          }
        </section>
      }

      <p class="note">إدارة النظام (المستخدمون، الأدوار، الفروع والأقسام والمكاتب) ولوحات المتابعة والإشعارات ليست خدمات تُسند — تحكمها الصلاحيات والأدوار.</p>
    </div>`,
  styles: [`
    .units { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
    .unit { display: inline-flex; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; border-radius: var(--radius-lg); background: var(--fill); }
    .type { padding: 2px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: var(--brand-100); color: var(--brand-700); }
    .type.t-Organization { background: var(--brand-600); color: var(--on-brand); }
    .hint-line { margin: -6px 0 16px; font-size: 12px; color: var(--ink-500); }
    .type.t-Department { background: var(--info-100); color: var(--info-700); }
    .type.t-Office { background: var(--purple-100); color: var(--purple-700); }
    .name { display: grid; line-height: 1.4; }
    .name strong { font-size: 14px; color: var(--ink-900); }
    .name small { font-size: 11px; color: var(--ink-500); }
    .remove { min-height: 26px; width: 26px; padding: 0; border-radius: 50%; background: var(--surface); color: var(--ink-600); font-size: 16px; line-height: 1; }
    .remove:hover:not(:disabled) { background: var(--danger-100); color: var(--danger-700); box-shadow: none; transform: none; }
    .unassigned { margin: 0 0 16px; padding: 14px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); color: var(--ink-500); font-size: 13px; }
    .add { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .add select { flex: 1; min-width: 240px; max-width: 520px; }
    .note { margin: 0; font-size: 12px; color: var(--ink-500); }
  `]
})
export class ModulesPage {
  private service = inject(ModuleService);
  private ewms = inject(EwmsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  typeLabel = TYPE_LABEL;
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditModuleAssignments));

  modules = signal<AppModule[]>([]);
  branches = signal<Branch[]>([]);
  departments = signal<Department[]>([]);
  offices = signal<Office[]>([]);
  loading = signal(false);
  /** مفتاح الخدمة الجاري حفظها */
  saving = signal('');
  error = signal('');

  constructor() { this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({
      modules: this.service.all(), branches: this.ewms.getBranches(),
      departments: this.ewms.getDepartments(), offices: this.ewms.getOffices()
    }).subscribe({
      next: r => {
        this.modules.set(r.modules); this.branches.set(r.branches);
        this.departments.set(r.departments); this.offices.set(r.offices);
        this.loading.set(false);
      },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  has(m: AppModule, type: ModuleUnitType, id: number) { return m.units.some(u => u.type === type && u.id === id); }

  add(m: AppModule, value: string) {
    const [type, id] = value.split(':');
    if (!type || (type !== 'Organization' && !Number(id))) return;
    this.save(m, [...m.units, { type: type as ModuleUnitType, id: Number(id) }], `أُسندت «${m.name}»`);
  }

  async remove(m: AppModule, unit: ModuleUnit) {
    const question = unit.type === 'Organization'
      ? `إلغاء إسناد «${m.name}» عن كل المؤسسة؟ ستبقى فقط للوحدات المحددة في القائمة${m.units.length > 1 ? '' : ' — ولا توجد وحدات أخرى، فلن يستخدمها أحد غير مدير النظام'}.`
      : `إلغاء إسناد «${m.name}» عن ${TYPE_LABEL[unit.type]} «${unit.name}»؟ لن تظهر الخدمة لموظفيه بعد ذلك.`;
    if (!await this.confirm.ask(question, 'إلغاء الإسناد')) return;
    this.save(m, m.units.filter(u => u !== unit), `أُلغي إسناد «${m.name}» عن «${unit.name}»`);
  }

  private save(m: AppModule, units: Pick<ModuleUnit, 'type' | 'id'>[], message: string) {
    this.saving.set(m.key);
    this.service.assign(m.key, units).subscribe({
      next: modules => { this.saving.set(''); this.modules.set(modules); this.toast.success(message); },
      error: e => { this.saving.set(''); this.toast.error(e.message); }
    });
  }
}
