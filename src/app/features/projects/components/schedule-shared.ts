import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { ProjectsService } from '../data-access/projects.service';

/** مستند يصلح داعماً أو موافقة: آخر إصدار معتمد من كل وثيقة، وإلا آخر إصدار */
export interface VersionChoice { id: number; label: string; approved: boolean; }

export function projectVersionChoices(projects: ProjectsService, projectId: number): Observable<VersionChoice[]> {
  return projects.documents({ projectId, kind: null, search: '', from: '', to: '', page: 1, pageSize: 100 }).pipe(
    map(page => page.items.flatMap(d => {
      const v = d.approved ?? d.latest;
      return v ? [{ id: v.id, approved: v.isApproved, label: `${d.title} — الإصدار ${v.versionNumber} (${v.fileName})${v.isApproved ? ' ✓' : ''}` }] : [];
    })));
}

/**
 * قرار على تبرير تأخير أو طلب تمديد: اعتماد أو رفض. الرفض بسبب. غير من سجّل أو طلب (يفرضه الخادم أيضاً).
 */
@Component({
  selector: 'app-schedule-decision-dialog', standalone: true, imports: [FormsModule, Modal, Alert],
  template: `
    <app-modal [heading]="heading()" [subheading]="subheading()" [busy]="busy()" (closed)="closed.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error() || problem()" />
          <ng-content />
          <fieldset class="choices">
            <label><input type="radio" name="d" [checked]="approve()" (change)="approve.set(true)"> {{ approveLabel() }}</label>
            <label><input type="radio" name="d" [checked]="!approve()" (change)="approve.set(false)"> رفض</label>
          </fieldset>
          <label class="form-field"><span class="form-label">الملاحظة <small class="hint">{{ approve() ? '(اختياري)' : '(مطلوبة عند الرفض)' }}</small></span>
            <textarea name="note" [(ngModel)]="note" rows="3" maxlength="1000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'تسجيل القرار' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.choices { display: flex; gap: 18px; border: 0; padding: 0; margin: 0; } .choices label { display: inline-flex; gap: 6px; align-items: center; font-weight: 700; }`]
})
export class ScheduleDecisionDialog {
  heading = input.required<string>();
  subheading = input('');
  approveLabel = input('اعتماد');
  busy = input(false);
  error = input('');
  submitted = output<{ approve: boolean; note: string }>();
  closed = output<void>();
  approve = signal(true);
  problem = signal('');
  note = '';

  save() {
    if (!this.approve() && !this.note.trim()) { this.problem.set('اذكر سبب الرفض'); return; }
    this.problem.set('');
    this.submitted.emit({ approve: this.approve(), note: this.note.trim() });
  }
}
