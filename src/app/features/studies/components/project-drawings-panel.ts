import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { latestRequest } from '@shared/ui/track-request';
import { StudyAccess } from '../data-access/study-access';
import { StudyDrawingsService } from '../data-access/study-drawings.service';
import { BasisOption, DRAWING_KINDS, DrawingKind, StudyDrawing, StudyProject } from '../data-access/studies.models';
import { StudyDrawingFormDialog } from './drawing-form-dialog';
import { StudyStatusChip } from './study-status-chip';

/**
 * مخططات المشروع: جدول بكل المخططات مع فلتر بالنوع، ومنه تُفتح صفحة المخطط (نسخه واعتماده ومرفقاته).
 * إضافة مخطط لمن يملك CreateStudyDrawing في مشروع جارٍ، والخادم يحصر التعديل بالقسم المُصدِر.
 * مخطط غير معماري يحتاج نسخة معمارية معتمدة يُبنى عليها (تُجلب عند فتح نافذة الإضافة).
 */
@Component({
  selector: 'app-study-project-drawings-panel',
  standalone: true,
  imports: [RouterLink, Alert, StudyStatusChip, StudyDrawingFormDialog],
  template: `
    <section class="panel">
      <div class="panel-heading">
        <div><h2>المخططات</h2><p>المعماري بنسخه واعتماده الأولي (CDA)، وبقية المخططات مبنية على نسخة معمارية معتمدة.</p></div>
        @if (can().createDrawing && project().status === 1) { <button type="button" class="btn" [disabled]="opening()" (click)="openCreate()">+ مخطط</button> }
      </div>
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />

      <nav class="chips" aria-label="نوع المخطط">
        <button type="button" [class.on]="kind() === 0" (click)="setKind(0)">الكل</button>
        @for (k of kinds; track k.value) { <button type="button" [class.on]="kind() === k.value" (click)="setKind(k.value)">{{ k.label }}</button> }
      </nav>

      @if (loading() && !rows().length) { <p class="muted">جارٍ التحميل…</p> }
      @else if (!rows().length && !error()) { <p class="muted">لا مخططات{{ kind() ? ' من هذا النوع' : '' }} بعد.</p> }
      @else if (rows().length) {
        <div class="table-wrap" [class.dim]="loading()"><table>
          <thead><tr><th>الرقم</th><th>المخطط</th><th>النوع</th><th>القسم المُصدِر</th><th>مبني على</th><th>الحالة</th></tr></thead>
          <tbody>
            @for (d of rows(); track d.id) {
              <tr>
                <td><a class="mono cell-strong" [routerLink]="['/studies/drawings', d.id]">{{ d.drawingNumber }}</a></td>
                <td><span class="cell-strong">{{ d.name }}</span></td>
                <td>{{ d.kindName }}</td>
                <td>{{ d.departmentName }}@if (d.officeName) { <small>{{ d.officeName }}</small> }</td>
                <td>{{ d.basedOnVersionLabel || '—' }}</td>
                <td><app-study-status-chip [status]="d.status" [name]="d.statusName" /></td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </section>

    @if (creating()) {
      @defer (on immediate) { <app-study-drawing-form-dialog [project]="project()" [basis]="basis()" (closed)="creating.set(false)" (saved)="created($event)" /> }
    }
  `,
  styles: [`
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .chips button { min-height: 30px; padding: 0 12px; border-radius: 999px; background: var(--fill); color: var(--ink-600); font-size: 13px; font-weight: 700; box-shadow: none; }
    .chips button.on { background: var(--brand-600); color: var(--on-brand); }
    td small { display: block; color: var(--ink-500); font-size: 12px; }
    .dim { opacity: .55; transition: opacity .15s; }
  `]
})
export class StudyProjectDrawingsPanel {
  private service = inject(StudyDrawingsService);
  private router = inject(Router);
  private latest = latestRequest();

  project = input.required<StudyProject>();

  can = inject(StudyAccess).can;
  kinds = DRAWING_KINDS;
  kind = signal<0 | DrawingKind>(0);
  rows = signal<StudyDrawing[]>([]);
  loading = signal(false);
  error = signal('');
  creating = signal(false);
  opening = signal(false);
  basis = signal<BasisOption[]>([]);

  constructor() {
    effect(() => { this.project(); this.kind(); untracked(() => this.load()); });
  }

  setKind(kind: 0 | DrawingKind) { this.kind.set(kind); }

  load() {
    this.latest(this.service.byProject(this.project().id, this.kind() || null), this.loading, this.error, list => this.rows.set(list));
  }

  /** النسخ المعمارية المعتمدة أولاً (لمخطط غير معماري) ثم تُفتح النافذة */
  openCreate() {
    this.opening.set(true);
    this.service.approvedBasis(this.project().id).subscribe({
      next: list => { this.basis.set(list); this.opening.set(false); this.creating.set(true); },
      error: () => { this.basis.set([]); this.opening.set(false); this.creating.set(true); }
    });
  }

  /** أُضيف المخطط: إلى صفحته لإضافة نسخه ومرفقاته */
  created(d: StudyDrawing) { this.creating.set(false); this.router.navigate(['/studies/drawings', d.id]); }
}
