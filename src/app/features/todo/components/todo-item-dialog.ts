import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../data-access/todo.service';
import { TODO_COLORS, TODO_LIMITS, TODO_REPEAT_LABEL, TODO_REPEAT_VALUE, ToDoItem, ToDoList } from '../data-access/todo.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/track-request';
import { FormActions } from '@shared/ui/form-actions';
import { Icon } from '@shared/ui/icon';

/** تعديل بند: العنوان والملاحظة والموعد والتكرار والأهمية واللون (المهمة المرتبطة تُعرض للاطلاع) */
@Component({
  selector: 'app-todo-item-dialog', standalone: true, imports: [Icon, FormActions, Alert, FormsModule, Modal],
  templateUrl: './todo-item-dialog.html',
  styles: [`
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
    .check { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: var(--ink-700); }
    .check input { width: auto; }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .swatch { width: 28px; height: 28px; min-height: 0; padding: 0; border-radius: 50%; border: 3px solid transparent; box-shadow: none; }
    .swatch.on { outline: 2px solid var(--ink-900); outline-offset: 2px; }
    .swatch:hover:not(:disabled) { transform: none; box-shadow: none; filter: brightness(.95); }
    .linked { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--ink-50); font-size: 13px; color: var(--ink-600); }
  `]
})
export class TodoItemDialog implements OnInit {
  private service = inject(ToDoService);

  item = input.required<ToDoItem>();
  saved = output<ToDoList>();
  closed = output<void>();

  limits = TODO_LIMITS;
  colors = TODO_COLORS;
  repeats = (Object.keys(TODO_REPEAT_LABEL) as (keyof typeof TODO_REPEAT_LABEL)[]).map(key => ({ key, label: TODO_REPEAT_LABEL[key] }));
  title = ''; note = ''; due = ''; repeat: 'None' | 'Daily' | 'Weekly' | 'Monthly' = 'None'; important = false; color = '';
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    const i = this.item();
    this.title = i.title; this.note = i.note; this.due = i.dueDate?.slice(0, 10) ?? ''; this.repeat = i.repeat ?? 'None'; this.important = i.isImportant; this.color = i.color ?? '';
  }

  save() {
    const i = this.item();
    if (this.saving() || !this.title.trim()) return;
    const change = {
      title: this.title.trim(), note: this.note.trim(), isImportant: this.important, color: this.color,
      ...(this.due ? { dueDate: this.due } : i.dueDate ? { clearDueDate: true } : {}),
      repeat: this.due ? TODO_REPEAT_VALUE[this.repeat] : 0
    };
    trackRequest(this.service.updateItem(i.id, change), this.saving, this.error, l => { this.saved.emit(l); });
  }
}
