import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToDoService } from '../data-access/todo.service';
import { TODO_COLORS, TODO_ICONS, TODO_LIMITS, ToDoList } from '../data-access/todo.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

/** نافذة إنشاء قائمة أو تعديلها: الاسم والوصف واللون والرمز */
@Component({
  selector: 'app-todo-list-dialog', standalone: true, imports: [Alert, FormsModule, Modal],
  template: `
    <app-modal [heading]="list() ? 'تعديل القائمة' : 'قائمة جديدة'" [busy]="saving()" (closed)="close.emit()">
      <form (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <label class="form-field"><span class="form-label">اسم القائمة</span>
            <input name="name" [maxlength]="limits.nameLength" [(ngModel)]="name" placeholder="مثال: مهام الأسبوع" autofocus autocomplete="off"></label>
          <label class="form-field"><span class="form-label">الوصف <small class="muted">(اختياري)</small></span>
            <textarea name="description" rows="3" [maxlength]="limits.descriptionLength" [(ngModel)]="description"></textarea></label>

          <fieldset class="form-field">
            <legend class="form-label">اللون</legend>
            <div class="swatches" role="radiogroup" aria-label="لون القائمة">
              @for (c of colors; track c.key) {
                <button type="button" class="swatch" role="radio" [attr.aria-checked]="color === c.key" [class.on]="color === c.key"
                        [style.background]="c.css" [attr.aria-label]="c.label" [title]="c.label" (click)="color = color === c.key ? '' : c.key"></button>
              }
            </div>
          </fieldset>

          <fieldset class="form-field">
            <legend class="form-label">الرمز <small class="muted">(اختياري)</small></legend>
            <div class="icons" role="radiogroup" aria-label="رمز القائمة">
              @for (i of icons; track i) {
                <button type="button" class="ico" role="radio" [attr.aria-checked]="icon === i" [class.on]="icon === i" (click)="icon = icon === i ? '' : i">{{ i }}</button>
              }
              <input class="own" name="icon" maxlength="8" [(ngModel)]="icon" placeholder="أو اكتب رمزاً" aria-label="رمز مخصص" autocomplete="off">
            </div>
          </fieldset>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="close.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="saving() || !name.trim()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
        </footer>
      </form>
    </app-modal>`,
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
  close = output<void>();

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
