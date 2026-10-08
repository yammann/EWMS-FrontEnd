import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../../core/services/todo.service';
import { TODO_LIMITS, ToDoList } from '../../core/models/todo.models';
import { Modal } from '../../shared/ui/modal';

/** إضافة عدة بنود دفعة واحدة: كل سطر بند (يناسب لصق نص منسوخ من رسالة أو محضر) */
@Component({
  selector: 'app-todo-bulk-dialog', standalone: true, imports: [FormsModule, Modal],
  template: `
    <app-modal heading="إضافة عدة بنود" subheading="كل سطر بند جديد" [busy]="saving()" (closed)="close.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          <label class="form-field"><span class="form-label">البنود</span>
            <textarea name="text" rows="9" [ngModel]="text()" (ngModelChange)="text.set($event)" autofocus
                      placeholder="اشتر الورق&#10;اتصل بالمورّد&#10;راجع التقرير"></textarea>
            <small class="form-hint" [class.warn]="tooMany()">{{ titles().length }} بنداً@if (tooMany()) { — الحد {{ limits.bulk }} في المرة }
              · المتاح في القائمة {{ room() }}</small></label>
          @if (long().length) { <p class="alert alert-error" role="alert">{{ long().length }} سطر أطول من {{ limits.titleLength }} حرفاً — قصّرها.</p> }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="saving() || !titles().length || tooMany() || long().length > 0 || titles().length > room()">
            {{ saving() ? 'جارٍ الإضافة…' : 'إضافة ' + titles().length + ' بنداً' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.form-hint.warn { color: var(--danger-600); }`]
})
export class TodoBulkDialog implements OnInit {
  private service = inject(ToDoService);

  list = input.required<ToDoList>();
  /** نص جاهز (من لصق في خانة الإضافة) */
  initialText = input('');
  saved = output<ToDoList>();
  close = output<void>();

  limits = TODO_LIMITS;
  text = signal('');
  saving = signal(false);
  error = signal('');

  titles = computed(() => this.text().split(/\r?\n/).map(t => t.trim()).filter(Boolean));
  long = computed(() => this.titles().filter(t => t.length > TODO_LIMITS.titleLength));
  tooMany = computed(() => this.titles().length > TODO_LIMITS.bulk);
  room = computed(() => Math.max(0, TODO_LIMITS.maxItems - this.list().itemsTotal));

  ngOnInit() { this.text.set(this.initialText()); }

  save() {
    if (this.saving() || !this.titles().length) return;
    this.saving.set(true); this.error.set('');
    this.service.bulkAdd(this.list().id, this.titles()).subscribe({
      next: l => { this.saving.set(false); this.saved.emit(l); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
