import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { RowActions } from '@shared/ui/row-actions';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { MemberCandidate, Project } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';

/**
 * مشاركو المشروع: من يُضاف مشاركاً يراه ضمن «مشاريعي» حتى بلا صلاحية القسم أو الفرع (إحالة المشروع إلى قسم آخر لا تفتحه لكل مستخدميه).
 * الإضافة والإزالة بصلاحية EditProject؛ المرشحون موظفو فرع المشروع النشطون الذين لم يُضافوا.
 */
@Component({
  selector: 'app-project-members-panel', standalone: true,
  imports: [DatePipe, FormsModule, Modal, Alert, RowActions, UtcPipe],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <section class="panel">
      <div class="panel-heading">
        <h2>المشاركون <span class="count">({{ project().members?.length ?? 0 }})</span></h2>
        @if (canEdit()) { <button class="btn" type="button" (click)="openAdd()">+ إضافة مشارك</button> }
      </div>
      <app-alert [message]="error()" />
      @if (project().members?.length) {
        <div class="table-wrap"><table>
          <thead><tr><th>الموظف</th><th>القسم</th><th>الصفة في المشروع</th><th>أُضيف</th>@if (canEdit()) { <th class="actions-th"></th> }</tr></thead>
          <tbody>
            @for (m of project().members; track m.userId) {
              <tr>
                <td class="cell-strong">{{ m.fullName }}</td>
                <td>{{ m.departmentName || '—' }}</td>
                <td>{{ m.title || '—' }}</td>
                <td>{{ m.addedAt | utc | date:'yyyy/MM/dd' }}</td>
                @if (canEdit()) {
                  <td><app-row-actions [canEdit]="false" [canDelete]="true" [deleting]="removing() === m.userId" (remove)="remove(m.userId, m.fullName)" /></td>
                }
              </tr>
            }
          </tbody>
        </table></div>
      } @else { <p class="muted">لا مشاركين.</p> }
    </section>

    @if (adding()) {
      <app-modal heading="إضافة مشارك" subheading="موظفو فرع المشروع النشطون" [busy]="busy()" (closed)="adding.set(false)">
        <form (ngSubmit)="add()">
          <div class="modal-body form-stack">
            <app-alert [message]="addError()" />
            <label class="form-field"><span class="form-label">ابحث بالاسم</span>
              <input type="search" name="q" [ngModel]="query()" (ngModelChange)="typing($event)" autocomplete="off" placeholder="اكتب جزءاً من الاسم…"></label>
            <div class="candidates" role="listbox" aria-label="المرشحون">
              @for (c of candidates(); track c.id) {
                <button type="button" role="option" class="candidate" [class.chosen]="chosen()?.id === c.id" [attr.aria-selected]="chosen()?.id === c.id" (click)="chosen.set(c)">
                  <span class="cell-strong">{{ c.fullName }}</span><small>{{ c.departmentName || '—' }}</small>
                </button>
              } @empty { <p class="muted">{{ loadingCandidates() ? 'جارٍ البحث…' : 'لا مرشحين مطابقين' }}</p> }
            </div>
            <label class="form-field"><span class="form-label">الصفة في المشروع <small class="hint">(اختياري، مثل مهندس الموقع)</small></span>
              <input name="title" [(ngModel)]="title" maxlength="100" autocomplete="off"></label>
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="adding.set(false)" [disabled]="busy()">إلغاء</button>
            <button type="submit" [disabled]="!chosen() || busy()">{{ busy() ? 'جارٍ الإضافة…' : 'إضافة' }}</button>
          </footer>
        </form>
      </app-modal>
    }`,
  styles: [`
    .candidates { display: grid; gap: 6px; max-height: 260px; overflow: auto; }
    .candidate { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; text-align: start;
      border-radius: var(--radius-md); background: var(--fill); color: var(--ink-800); box-shadow: none; }
    .candidate:hover:not(:disabled) { background: var(--fill-strong); transform: none; box-shadow: none; }
    .candidate.chosen { background: var(--brand-50); color: var(--brand-700); outline: 2px solid var(--brand-600); }
    .candidate small { color: var(--ink-500); }
  `]
})
export class ProjectMembersPanel {
  private service = inject(ProjectsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  project = input.required<Project>();
  /** EditProject وليس مغلقاً */
  canEdit = input(false);
  changed = output<Project>();

  error = signal('');
  removing = signal<number | null>(null);

  adding = signal(false);
  busy = signal(false);
  addError = signal('');
  query = signal('');
  title = '';
  chosen = signal<MemberCandidate | null>(null);
  loadingCandidates = signal(false);
  private candidatesError = signal('');
  candidates = signal<MemberCandidate[]>([]);
  private latest = latestRequest();
  private timer?: ReturnType<typeof setTimeout>;

  openAdd() {
    this.adding.set(true); this.addError.set(''); this.chosen.set(null); this.title = ''; this.query.set('');
    this.fetch('');
  }

  /** بحث بعد توقف الكتابة (لا طلب لكل حرف) */
  typing(value: string) {
    this.query.set(value); this.chosen.set(null);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fetch(value), 250);
  }

  private fetch(value: string) {
    this.latest(this.service.memberCandidates(this.project().id, value), this.loadingCandidates, this.candidatesError, list => this.candidates.set(list));
  }

  add() {
    const c = this.chosen();
    if (!c || this.busy()) return;
    trackRequest(this.service.addMember(this.project().id, c.id, this.title.trim()), this.busy, this.addError, p => {
      this.adding.set(false);
      this.toast.success('أُضيف المشارك');
      this.changed.emit(p);
    });
  }

  async remove(userId: number, name: string) {
    if (!(await this.confirm.ask(`إزالة «${name}» من مشاركي المشروع؟ لن يراه ضمن «مشاريعي» بعد ذلك إن لم تكن له صلاحية قسم أو فرع.`, 'إزالة'))) return;
    this.error.set('');
    this.removing.set(userId);
    this.service.removeMember(this.project().id, userId).subscribe({
      next: p => { this.removing.set(null); this.toast.success('أُزيل المشارك'); this.changed.emit(p); },
      error: e => { this.removing.set(null); this.error.set(e.message ?? 'تعذّرت الإزالة'); }
    });
  }
}
