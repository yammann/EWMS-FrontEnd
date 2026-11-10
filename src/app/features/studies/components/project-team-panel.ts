import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map, of, switchMap } from 'rxjs';
import { orEmpty } from '@core/http/or-empty';
import { LookupsService } from '@core/services/lookups.service';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { StudyAccess } from '../data-access/study-access';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { ProjectDepartment, StudyEmployee, StudyProject } from '../data-access/studies.models';

interface DepartmentOption { id: number; name: string; }

/**
 * فريق المشروع: الأقسام المشاركة (تضيفها إدارة المشاريع) ولكل قسم أعضاء يعيّنهم رئيسه من موظفي قسمه.
 * أزرار الأعضاء حسب علم الخادم canManageMembers، وأزرار الأقسام حسب صلاحيتَي الإضافة والإزالة.
 * كل عملية تعيد المشروع كاملاً فيُرفع للصفحة (`updated`). المهام تُسنَد لأقسام الفريق ومكاتبها وأعضائه.
 */
@Component({
  selector: 'app-study-project-team-panel',
  standalone: true,
  imports: [DatePipe, UtcPipe, FormsModule, Alert, Icon, Modal],
  template: `
    <section class="panel">
      <div class="panel-heading">
        <div><h2>فريق المشروع</h2><p>الأقسام المشاركة وأعضاؤها. يعيّن رئيس كل قسم أعضاء قسمه.</p></div>
        @if (can().addProjectDepartment && project().status === 1) { <button type="button" class="btn" (click)="openAddDepartment()">+ قسم مشارك</button> }
      </div>
      <app-alert [message]="error()" />
      @if (!project().departments.length) { <p class="muted">لا أقسام مشاركة بعد.</p> }
      <div class="departments">
        @for (d of project().departments; track d.id) {
          <article class="department">
            <header>
              <div><strong>{{ d.departmentName }}</strong>
                <small class="muted">أضافه {{ d.addedByName }} · {{ d.addedAt | utc | date:'yyyy/MM/dd' }}@if (d.offices.length) { · {{ d.offices.length }} مكتب }</small></div>
              <div class="actions">
                @if (d.canManageMembers && project().status === 1) { <button type="button" class="btn btn-ghost btn-sm" (click)="openAddMember(d)">+ عضو</button> }
                @if (can().removeProjectDepartment) { <button type="button" class="icon-btn del" [attr.aria-label]="'إزالة ' + d.departmentName" (click)="removeDepartment(d)"><app-icon name="trash" [size]="15" /></button> }
              </div>
            </header>
            @if (!d.members.length) { <p class="muted none">لا أعضاء.</p> } @else {
              <ul class="members">
                @for (m of d.members; track m.userId) {
                  <li>
                    <span class="avatar" aria-hidden="true">{{ m.fullName.charAt(0) }}</span>
                    <span class="who"><strong>{{ m.fullName }}</strong><small class="muted">{{ m.roleTitle || 'عضو' }} · {{ m.assignedByName }}</small></span>
                    @if (d.canManageMembers) { <button type="button" class="icon-btn del" [attr.aria-label]="'إزالة ' + m.fullName" (click)="removeMember(d, m.userId, m.fullName)"><app-icon name="xmark" [size]="14" /></button> }
                  </li>
                }
              </ul>
            }
          </article>
        }
      </div>
    </section>

    @if (addingDepartment()) {
      <app-modal heading="إضافة قسم مشارك" [subheading]="project().code" [busy]="busy()" (closed)="addingDepartment.set(false)">
        <div class="modal-body form-stack">
          <app-alert [message]="dialogError()" />
          <label class="form-field"><span class="form-label">القسم</span>
            <select [(ngModel)]="pickedDepartment">
              <option [ngValue]="0" disabled>اختر…</option>
              @for (o of departmentOptions(); track o.id) { <option [ngValue]="o.id">{{ o.name }}</option> }
            </select>
            @if (departmentsLoaded() && !departmentOptions().length) { <small class="hint">لا أقسام أخرى متاحة في فرع المشروع.</small> }</label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="addingDepartment.set(false)">إلغاء</button>
          <button type="button" [disabled]="!pickedDepartment || busy()" (click)="addDepartment()">إضافة</button>
        </footer>
      </app-modal>
    }

    @if (addingTo(); as d) {
      <app-modal heading="إضافة عضو" [subheading]="d.departmentName" [busy]="busy()" (closed)="addingTo.set(null)">
        <div class="modal-body form-stack">
          <app-alert [message]="dialogError()" />
          <label class="form-field"><span class="form-label">الموظف</span>
            <select [(ngModel)]="pickedUser">
              <option [ngValue]="0" disabled>اختر…</option>
              @for (e of memberOptions(); track e.id) { <option [ngValue]="e.id">{{ e.fullName }}{{ e.officeName ? ' — ' + e.officeName : '' }}</option> }
            </select>
            @if (employeesLoaded() && !memberOptions().length) { <small class="hint">لا موظفون آخرون في هذا القسم.</small> }</label>
          <label class="form-field"><span class="form-label">الصفة في المشروع <small class="hint">(اختياري)</small></span>
            <input [(ngModel)]="roleTitle" maxlength="100" placeholder="مثال: مهندس إنشائي"></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="addingTo.set(null)">إلغاء</button>
          <button type="button" [disabled]="!pickedUser || busy()" (click)="addMember()">إضافة</button>
        </footer>
      </app-modal>
    }
  `,
  styles: [`
    .departments { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .department { padding: 14px; border-radius: 14px; background: var(--fill); display: grid; gap: 10px; align-content: start; min-width: 0; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    header small { display: block; }
    .actions { display: flex; align-items: center; gap: 4px; }
    .members { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .members li { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
    .avatar { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--brand-100); color: var(--brand-700); font-weight: 700; font-size: 13px; }
    .who { display: grid; min-width: 0; }
    .who small { font-size: 12px; }
    .none { margin: 0; font-size: 13px; }
    .del { color: var(--danger-700); }
  `]
})
export class StudyProjectTeamPanel {
  private service = inject(StudyProjectsService);
  private lookups = inject(LookupsService);
  private studyLookups = inject(StudyLookupsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  project = input.required<StudyProject>();
  /** عملية فريق نجحت: المشروع بعد التعديل */
  updated = output<StudyProject>();

  can = inject(StudyAccess).can;
  busy = signal(false);
  error = signal('');
  dialogError = signal('');

  addingDepartment = signal(false);
  allDepartments = signal<DepartmentOption[]>([]);
  departmentsLoaded = signal(false);
  pickedDepartment = 0;
  /** أقسام فرع المشروع التي لم تشارك بعد */
  departmentOptions = computed(() => {
    const taken = new Set(this.project().departments.map(d => d.departmentId));
    return this.allDepartments().filter(d => !taken.has(d.id));
  });

  addingTo = signal<ProjectDepartment | null>(null);
  employees = signal<StudyEmployee[]>([]);
  employeesLoaded = signal(false);
  pickedUser = 0;
  roleTitle = '';
  memberOptions = computed(() => {
    const d = this.addingTo();
    const taken = new Set(d?.members.map(m => m.userId));
    return this.employees().filter(e => !taken.has(e.id));
  });

  // ─────────── الأقسام ───────────
  openAddDepartment() {
    this.pickedDepartment = 0; this.dialogError.set(''); this.addingDepartment.set(true);
    if (this.departmentsLoaded()) return;
    const branchId = this.project().branchId;
    // قائمة أقسام الهيكل تحتاج ViewDepartments؛ من لا يملكها نستخرج أقسام فرعه من موظفيه (إن تيسّرت له قائمة الموظفين)
    this.lookups.departments().pipe(
      map(list => list.filter(d => d.branchId === branchId).map(d => ({ id: d.id, name: d.name }))),
      orEmpty(() => undefined),
      switchMap(list => list.length ? of(list) : this.fromEmployees(branchId))
    ).subscribe(list => { this.allDepartments.set(list); this.departmentsLoaded.set(true); });
  }

  private fromEmployees(branchId: number): Observable<DepartmentOption[]> {
    return this.studyLookups.employees({ branchId }).pipe(
      map(list => {
        const seen = new Map<number, DepartmentOption>();
        for (const e of list) if (e.departmentId && e.departmentName) seen.set(e.departmentId, { id: e.departmentId, name: e.departmentName });
        return [...seen.values()];
      }),
      orEmpty(() => undefined)
    );
  }

  addDepartment() {
    this.run(this.service.addDepartment(this.project().id, this.pickedDepartment), 'أُضيف القسم', () => this.addingDepartment.set(false), true);
  }

  async removeDepartment(d: ProjectDepartment) {
    if (!await this.confirm.ask(`إزالة القسم «${d.departmentName}» من المشروع؟ لا يُزال قسم له مهام أو مخططات.`, 'إزالة')) return;
    this.run(this.service.removeDepartment(d.id), 'أُزيل القسم');
  }

  // ─────────── الأعضاء ───────────
  openAddMember(d: ProjectDepartment) {
    this.pickedUser = 0; this.roleTitle = ''; this.dialogError.set(''); this.employeesLoaded.set(false); this.employees.set([]);
    this.addingTo.set(d);
    this.studyLookups.employees({ departmentId: d.departmentId }).pipe(orEmpty(() => this.dialogError.set('تعذّر تحميل موظفي القسم.')))
      .subscribe(list => { this.employees.set(list); this.employeesLoaded.set(true); });
  }

  addMember() {
    const d = this.addingTo();
    if (d) this.run(this.service.addMember(d.id, this.pickedUser, this.roleTitle), 'أُضيف العضو', () => this.addingTo.set(null), true);
  }

  async removeMember(d: ProjectDepartment, userId: number, name: string) {
    if (!await this.confirm.ask(`إزالة «${name}» من فريق ${d.departmentName}؟`, 'إزالة')) return;
    this.run(this.service.removeMember(d.id, userId), 'أُزيل العضو');
  }

  private run(call: Observable<StudyProject>, message: string, after?: () => void, inDialog = false) {
    this.busy.set(true); this.error.set(''); this.dialogError.set('');
    call.subscribe({
      next: p => { this.busy.set(false); after?.(); this.toast.success(message); this.updated.emit(p); },
      error: e => { this.busy.set(false); (inDialog ? this.dialogError : this.error).set(e.message ?? 'تعذّر تنفيذ الإجراء'); }
    });
  }
}
