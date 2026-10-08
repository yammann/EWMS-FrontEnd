import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssignedTaskService } from '../../core/services/assigned-task.service';
import { AuthService } from '../../core/services/auth.service';
import { DeviceService } from '../../core/services/device.service';
import { AppPermission, DEVICE_ACCESS } from '../../core/constants/access';
import { AssignedTaskCard, LINK_TYPE_LABEL, TaskLink, TaskLinkType } from '../../core/models/assigned-task.models';
import { Site } from '../../core/models/device.models';
import { ConfirmService } from '../../shared/ui/confirm.service';

/** وجهة رابط سجل في نظامه (أو null إن لم تتوفر للمستخدم صفحة له) */
export function linkRoute(type: TaskLinkType, id: number, canPrintVacation: boolean): string | null {
  switch (type) {
    case 'MaintenanceRequest': return `/maintenance/requests/${id}`;
    case 'Site': return `/devices/sites/${id}`;
    default: return canPrintVacation ? `/vacations/print/${id}` : null;
  }
}

/**
 * ربط المهمة بسجلات من أنظمة أخرى (طلب صيانة / إجازة / موقع). الخادم يرفض الربط بسجل لا يحق لك عرضه،
 * ولمن لا يحق له عرض السجل المرتبط يُظهر وجود رابط بلا بياناته.
 */
@Component({
  selector: 'app-task-links', standalone: true, imports: [FormsModule],
  template: `
    @if (links().length) {
      <ul class="links">
        @for (l of links(); track l.id) {
          <li [class.na]="!l.available">
            <span class="kind">{{ l.entityTypeAr }}</span>
            @if (route(l); as r) { <a class="label" href="javascript:void 0" (click)="go(r)">{{ l.label }}</a> }
            @else { <span class="label">{{ l.label }}</span> }
            @if (l.canRemove && canEdit()) { <button type="button" class="x" (click)="remove(l)" [disabled]="busy()" [attr.aria-label]="'حذف رابط ' + l.label" title="حذف">×</button> }
          </li>
        }
      </ul>
    } @else { <p class="muted">لا توجد روابط.</p> }

    @if (canEdit()) {
      <form class="add" (ngSubmit)="add()">
        <select name="type" [(ngModel)]="type" aria-label="نوع السجل">
          <option value="MaintenanceRequest">{{ labels.MaintenanceRequest }}</option>
          <option value="Vacation">{{ labels.Vacation }}</option>
          @if (canSites()) { <option value="Site">{{ labels.Site }}</option> }
        </select>
        @if (type === 'Site') {
          <select name="site" [(ngModel)]="siteId" aria-label="الموقع">
            <option [ngValue]="0">اختر الموقع</option>
            @for (s of sites(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
          </select>
        } @else {
          <input name="ref" [(ngModel)]="reference" maxlength="40" [placeholder]="type === 'Vacation' ? 'رقم الإجازة: VAC-2026-00005' : 'رقم الطلب: MR-2026-00012'" autocomplete="off">
        }
        <button type="submit" class="btn btn-sm" [disabled]="busy() || (type === 'Site' ? !siteId : !reference.trim())">ربط</button>
      </form>
      @if (error()) { <p class="alert alert-error err" role="alert">{{ error() }}</p> }
    }`,
  styles: [`
    .links { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 6px; }
    .links li { display: flex; align-items: center; gap: 8px; padding: 6px 12px; min-height: 40px; border-radius: var(--radius-md); background: var(--fill); font-size: 13px; }
    .links li.na { color: var(--ink-400); }
    .kind { flex: none; padding: 1px 8px; border-radius: var(--radius-full); background: var(--brand-50); color: var(--brand-700); font-size: 11px; font-weight: 800; }
    .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
    a.label { color: var(--brand-700); }
    .x { min-height: 28px; width: 28px; padding: 0; background: transparent; color: var(--ink-500); font-size: 18px; box-shadow: none; }
    .add { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; }
    .add select, .add input { min-width: 0; }
    .muted { margin: 0 0 8px; color: var(--ink-500); font-size: 13px; }
    .err { margin: 8px 0 0; }
  `]
})
export class TaskLinks implements OnInit {
  private service = inject(AssignedTaskService);
  private auth = inject(AuthService);
  private devices = inject(DeviceService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);

  taskId = input.required<number>();
  /** المُسنِد أو المنفِّذ، والمهمة غير منجزة */
  canEdit = input(false);

  labels = LINK_TYPE_LABEL;
  links = signal<TaskLink[]>([]);
  sites = signal<Site[]>([]);
  busy = signal(false);
  error = signal('');
  type: TaskLinkType = 'MaintenanceRequest';
  reference = '';
  siteId = 0;
  canSites = computed(() => this.auth.hasAnyPermission(DEVICE_ACCESS));
  private canPrint = computed(() => this.auth.hasPermission(AppPermission.PrintVacation));

  constructor() {
    effect(() => { const id = this.taskId(); this.service.links(id).subscribe({ next: l => this.links.set(l), error: () => this.links.set([]) }); });
  }

  ngOnInit() {
    if (this.canSites()) this.devices.sites().subscribe({ next: s => this.sites.set(s), error: () => { /* الموقع اختياري */ } });
  }

  route(l: TaskLink) { return l.available ? linkRoute(l.entityType, l.entityId, this.canPrint()) : null; }
  go(path: string) { this.router.navigateByUrl(path); }

  add() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    const request = this.type === 'Site'
      ? this.service.addLink(this.taskId(), 'Site', null, this.siteId)
      : this.service.addLink(this.taskId(), this.type, this.reference.trim());
    request.subscribe({
      next: l => { this.busy.set(false); this.links.set(l); this.reference = ''; this.siteId = 0; },
      error: e => { this.busy.set(false); this.error.set(e.message); }
    });
  }

  async remove(l: TaskLink) {
    if (!(await this.confirm.ask(`إزالة ربط المهمة بـ«${l.label}»؟`, 'إزالة'))) return;
    this.busy.set(true);
    this.service.removeLink(l.id).subscribe({
      next: list => { this.busy.set(false); this.links.set(list); },
      error: e => { this.busy.set(false); this.error.set(e.message); }
    });
  }
}

/** المهام المرتبطة بسجل (تُعرض في صفحة الطلب/الموقع) — تظهر فقط لمن يحق له عرض السجل ولوحة المهام */
@Component({
  selector: 'app-linked-tasks', standalone: true,
  template: `
    @if (tasks().length) {
      <section class="panel linked">
        <div class="panel-heading"><div><h2>المهام المرتبطة</h2><p class="muted">مهام في لوحة المهام مرتبطة بهذا السجل</p></div></div>
        <ul>
          @for (t of tasks(); track t.id) {
            <li><a href="javascript:void 0" (click)="open(t)">{{ t.title }}</a>
              <span class="chip">{{ t.statusAr }}</span><small>{{ t.targetName }}</small></li>
          }
        </ul>
      </section>
    }`,
  styles: [`
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); background: var(--fill); font-size: 13px; }
    li a { flex: 1; font-weight: 700; color: var(--brand-700); }
    .chip { padding: 2px 10px; border-radius: var(--radius-full); background: var(--brand-50); color: var(--brand-700); font-size: 11px; font-weight: 800; }
    small { color: var(--ink-500); }
  `]
})
export class LinkedTasks {
  private service = inject(AssignedTaskService);
  private auth = inject(AuthService);
  private router = inject(Router);

  entityType = input.required<TaskLinkType>();
  entityId = input.required<number>();
  tasks = signal<AssignedTaskCard[]>([]);

  constructor() {
    effect(() => {
      const [type, id] = [this.entityType(), this.entityId()];
      if (!id || !this.auth.hasPermission(AppPermission.ViewTaskBoard)) { this.tasks.set([]); return; }
      this.service.byLink(type, id).subscribe({ next: t => this.tasks.set(t), error: () => this.tasks.set([]) });
    });
  }

  open(t: AssignedTaskCard) { this.router.navigateByUrl(`/task-board?task=${t.id}`); }
}
