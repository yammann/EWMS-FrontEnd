import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../data-access/todo.service';
import { TODO_LIMITS, TODO_REPEAT_LABEL, TODO_REPEAT_VALUE, ToDoItem, ToDoList } from '../data-access/todo.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';

/** تعديل بند: العنوان والملاحظة والموعد والتكرار والأهمية (المهمة المرتبطة تُعرض للاطلاع) */
@Component({
  selector: 'app-todo-item-dialog', standalone: true, imports: [Alert, FormsModule, Modal],
  template: `
    <app-modal heading="تعديل البند" [busy]="saving()" (closed)="close.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <label class="form-field"><span class="form-label">العنوان</span>
            <input name="title" [maxlength]="limits.titleLength" [(ngModel)]="title" autofocus autocomplete="off"></label>
          <label class="form-field"><span class="form-label">ملاحظة <small class="muted">(اختياري)</small></span>
            <textarea name="note" rows="3" [maxlength]="limits.noteLength" [(ngModel)]="note"></textarea></label>
          <div class="two">
            <label class="form-field"><span class="form-label">الموعد <small class="muted">(اختياري — منه تأتي «اليوم» والتذكيرات)</small></span>
              <input name="due" type="date" [(ngModel)]="due"></label>
            <label class="form-field"><span class="form-label">التكرار</span>
              <select name="repeat" [(ngModel)]="repeat" [disabled]="!due">
                <option value="None">بلا تكرار</option>
                @for (r of repeats; track r.key) { <option [value]="r.key">{{ r.label }}</option> }
              </select>
              @if (!due) { <small class="form-hint">يحتاج التكرار موعداً.</small> }</label>
          </div>
          <label class="check"><input name="important" type="checkbox" [(ngModel)]="important"> ★ مهم</label>
          @if (item().linkedTask; as t) {
            <p class="linked">مرتبط بمهمة في لوحة المهام: <strong>{{ t.available ? t.title : 'مهمة غير متاحة لك' }}</strong>@if (t.available) { — {{ t.statusAr }} }</p>
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="saving() || !title.trim()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
    .check { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: var(--ink-700); }
    .check input { width: auto; }
    .linked { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--ink-50); font-size: 13px; color: var(--ink-600); }
  `]
})
export class TodoItemDialog implements OnInit {
  private service = inject(ToDoService);

  item = input.required<ToDoItem>();
  saved = output<ToDoList>();
  close = output<void>();

  limits = TODO_LIMITS;
  repeats = (Object.keys(TODO_REPEAT_LABEL) as (keyof typeof TODO_REPEAT_LABEL)[]).map(key => ({ key, label: TODO_REPEAT_LABEL[key] }));
  title = ''; note = ''; due = ''; repeat: 'None' | 'Daily' | 'Weekly' | 'Monthly' = 'None'; important = false;
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    const i = this.item();
    this.title = i.title; this.note = i.note; this.due = i.dueDate?.slice(0, 10) ?? ''; this.repeat = i.repeat ?? 'None'; this.important = i.isImportant;
  }

  save() {
    const i = this.item();
    if (this.saving() || !this.title.trim()) return;
    const change = {
      title: this.title.trim(), note: this.note.trim(), isImportant: this.important,
      ...(this.due ? { dueDate: this.due } : i.dueDate ? { clearDueDate: true } : {}),
      repeat: this.due ? TODO_REPEAT_VALUE[this.repeat] : 0
    };
    this.saving.set(true); this.error.set('');
    this.service.updateItem(i.id, change).subscribe({
      next: l => { this.saving.set(false); this.saved.emit(l); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
