import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../data-access/todo.service';
import { TODO_COLORS, TODO_ICONS, TODO_LIMITS, ToDoList } from '../data-access/todo.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

/** نافذة إنشاء قائمة أو تعديلها: الاسم والوصف واللون والرمز */
@Component({
  selector: 'app-todo-list-dialog', standalone: true, imports: [FormActions, Alert, FormsModule, Modal],
  templateUrl: './todo-list-dialog.html',
  styles: [`
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    .swatches, .icons { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .swatch { width: 30px; height: 30px; min-height: 0; padding: 0; border-radius: 50%; border: 3px solid transparent; box-shadow: none; }
    .swatch.on { outline: 2px solid var(--ink-900); outline-offset: 2px; }
    .swatch:hover:not(:disabled) { transform: none; box-shadow: none; filter: brightness(.95); }
    .ico { width: 38px; min-height: 38px; padding: 0; font-size: 18px; background: var(--fill); box-shadow: none; }
    .ico.on { background: var(--brand-50); outline: 2px solid var(--brand-600); }
    .ico:hover:not(:disabled) { transform: none; box-shadow: none; background: var(--fill-strong); }
    .own { width: 130px; }
  `]
})
export class TodoListDialog implements OnInit {
  private service = inject(ToDoService);

  list = input<ToDoList | null>(null);
  saved = output<ToDoList>();
  closed = output<void>();

  limits = TODO_LIMITS;
  colors = TODO_COLORS;
  icons = TODO_ICONS;
  name = ''; description = ''; color = ''; icon = '';
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    const l = this.list();
    if (l) { this.name = l.name; this.description = l.description; this.color = l.color; this.icon = l.icon; }
  }

  save() {
    if (this.saving() || !this.name.trim()) return;
    const body = { name: this.name.trim(), description: this.description.trim(), color: this.color, icon: this.icon.trim() };
    const l = this.list();
    trackRequest((l ? this.service.update(l.id, body) : this.service.create(body)), this.saving, this.error, saved => { this.saved.emit(saved); });
  }
}
