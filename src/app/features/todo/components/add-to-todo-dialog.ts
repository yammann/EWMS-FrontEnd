import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../data-access/todo.service';
import { ToDoList } from '../data-access/todo.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

/** إضافة مهمة من لوحة المهام إلى إحدى قوائم مفكرتي كبند مرتبط بها (تُظهر حالتها وتفتحها) */
@Component({
  selector: 'app-add-to-todo-dialog', standalone: true, imports: [FormActions, Alert, FormsModule, Modal],
  template: `
    <app-modal heading="أضف إلى مفكرتي" [subheading]="taskTitle()" [busy]="saving()" (closed)="closed.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (loading()) { <p class="muted" role="status">جارٍ تحميل قوائمك…</p> }
          @else if (!lists().length) { <p class="muted">لا توجد قوائم نشطة — أنشئ قائمة من صفحة مفكرتي أولاً.</p> }
          @else {
            <label class="form-field"><span class="form-label">القائمة</span>
              <select name="list" [(ngModel)]="listId" autofocus>
                @for (l of lists(); track l.id) { <option [ngValue]="l.id">{{ l.icon }} {{ l.name }}</option> }
              </select></label>
            <p class="note">يُنشأ بند بعنوان المهمة وموعدها، ويبقى مرتبطاً بها: ترى حالتها من مفكرتك وتفتحها بنقرة.</p>
          }
        </div>
        <app-form-actions [busy]="saving()" [disabled]="!listId" label="إضافة" busyLabel="جارٍ الإضافة…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>`,
  styles: [`.note { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--ink-50); font-size: 12px; color: var(--ink-600); } .muted { margin: 0; color: var(--ink-500); }`]
})
export class AddToTodoDialog implements OnInit {
  private service = inject(ToDoService);

  taskId = input.required<number>();
  taskTitle = input('');
  done = output<ToDoList>();
  closed = output<void>();

  all = signal<ToDoList[]>([]);
  lists = computed(() => this.all().filter(l => !l.isArchived));
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  listId = 0;

  ngOnInit() {
    this.service.lists().subscribe({
      next: l => { this.all.set(l); this.listId = this.lists()[0]?.id ?? 0; this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  save() {
    if (this.saving() || !this.listId) return;
    trackRequest(this.service.addTask(this.listId, this.taskId()), this.saving, this.error, l => { this.done.emit(l); });
  }
}
