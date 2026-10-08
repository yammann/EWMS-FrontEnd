import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../../core/services/todo.service';
import { TODO_LIMITS, ToDoList } from '../../core/models/todo.models';
import { Modal } from '../../shared/ui/modal';

/** نافذة إنشاء قائمة أو تعديل اسمها ووصفها */
@Component({
  selector: 'app-todo-list-dialog', standalone: true, imports: [FormsModule, Modal],
  template: `
    <app-modal [heading]="list() ? 'تعديل القائمة' : 'قائمة جديدة'" [busy]="saving()" (closed)="close.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          <label class="form-field"><span class="form-label">اسم القائمة</span>
            <input name="name" [maxlength]="limits.nameLength" [(ngModel)]="name" placeholder="مثال: مهام الأسبوع" autofocus autocomplete="off"></label>
          <label class="form-field"><span class="form-label">الوصف <small class="muted">(اختياري)</small></span>
            <textarea name="description" rows="3" [maxlength]="limits.descriptionLength" [(ngModel)]="description"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="saving() || !name.trim()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
        </footer>
      </form>
    </app-modal>`
})
export class TodoListDialog implements OnInit {
  private service = inject(ToDoService);

  list = input<ToDoList | null>(null);
  saved = output<ToDoList>();
  close = output<void>();

  limits = TODO_LIMITS;
  name = ''; description = '';
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    const l = this.list();
    if (l) { this.name = l.name; this.description = l.description; }
  }

  save() {
    if (this.saving() || !this.name.trim()) return;
    const body = { name: this.name.trim(), description: this.description.trim() };
    const l = this.list();
    this.saving.set(true); this.error.set('');
    (l ? this.service.update(l.id, body) : this.service.create(body)).subscribe({
      next: saved => { this.saving.set(false); this.saved.emit(saved); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
