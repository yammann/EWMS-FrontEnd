import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { DOCUMENT_KINDS, ProjectDocument } from '../data-access/projects.models';
import { ProjectUploader } from '../data-access/project-uploader.service';
import { bigFileSize, titleFromFileName } from '../utils/upload-plan';

/**
 * رفع وثيقة جديدة أو إصدار جديد لوثيقة موجودة. الملفات تُرفع بأجزاء في الخلفية (خدمة عامة) فتُغلق النافذة فور البدء
 * ويتابع المستخدم التقدّم في لوحة الوثائق. الإصدار الجديد يُضاف ولا يستبدل شيئاً، والاعتماد يتم لاحقاً على يد موظف آخر.
 */
@Component({
  selector: 'app-document-upload-dialog', standalone: true,
  imports: [FormsModule, Modal, Alert, Icon, SelectValue],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal [heading]="document() ? 'إصدار جديد' : 'رفع وثائق'" [subheading]="document() ? document()!.title : 'يُرفع كل ملف وثيقةً مستقلة بعنوان من اسمه'"
               size="lg" (closed)="closed.emit()">
      <form (ngSubmit)="start()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <div class="drop" [class.over]="over()" (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="drop($event)">
            <app-icon name="paperclip" [size]="22" />
            <p>اسحب الملفات هنا، أو</p>
            <label class="btn btn-ghost pick">اختر {{ document() ? 'الملف' : 'ملفات' }}
              <input #f type="file" [multiple]="!document()" (change)="choose(f.files); f.value = ''" hidden>
            </label>
            <small class="hint">تُرفع الملفات الكبيرة بأجزاء وتُستأنف إن انقطع الاتصال؛ الحد الأقصى يحدده الخادم (50GB افتراضياً).</small>
          </div>

          @if (files().length) {
            <ul class="files">
              @for (f of files(); track f.name + f.size; let i = $index) {
                <li><span class="name">{{ f.name }}</span><span class="size"><bdi dir="ltr">{{ size(f.size) }}</bdi></span>
                  <button type="button" class="icon-btn" (click)="remove(i)" aria-label="إزالة"><app-icon name="xmark" [size]="14" /></button></li>
              }
            </ul>
          }

          <div class="form-grid-2">
            @if (!document()) {
              <label class="form-field"><span class="form-label">نوع الوثيقة</span>
                <select #k [appSelectValue]="kind()" (change)="kind.set(+k.value)">
                  @for (x of kinds; track x.value) { <option [value]="x.value">{{ x.label }}</option> }
                </select></label>
            }
            <label class="form-field"><span class="form-label">المصدر <small class="hint">(الجهة التي وردت منها، اختياري)</small></span>
              <input name="source" [(ngModel)]="source" maxlength="200" autocomplete="off"></label>
          </div>
          <label class="form-field"><span class="form-label">ملاحظة <small class="hint">(اختياري)</small></span>
            <textarea name="note" [(ngModel)]="note" rows="2" maxlength="1000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()">إلغاء</button>
          <button type="submit" [disabled]="!files().length">{{ files().length > 1 ? 'بدء رفع ' + files().length + ' ملفات' : 'بدء الرفع' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .drop { display: grid; justify-items: center; gap: 6px; padding: 22px; border: 2px dashed var(--border); border-radius: var(--radius-lg); text-align: center; color: var(--ink-600); }
    .drop.over { border-color: var(--brand-600); background: var(--brand-50); }
    .drop p { margin: 0; }
    .pick { cursor: pointer; }
    .files { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .files li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); background: var(--fill); font-size: 13px; }
    .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; text-align: start; }
    .size { color: var(--ink-500); }
  `]
})
export class DocumentUploadDialog {
  private uploader = inject(ProjectUploader);

  projectId = input.required<number>();
  /** إصدار جديد لهذه الوثيقة؛ null = وثائق جديدة */
  document = input<ProjectDocument | null>(null);
  started = output<void>();
  closed = output<void>();

  kinds = DOCUMENT_KINDS;
  size = bigFileSize;
  files = signal<File[]>([]);
  kind = signal<number>(99);
  source = '';
  note = '';
  over = signal(false);
  error = signal('');
  hasFiles = computed(() => this.files().length > 0);

  choose(list: FileList | null) {
    if (!list?.length) return;
    this.error.set('');
    const picked = Array.from(list);
    this.files.update(current => this.document() ? picked.slice(0, 1) : [...current, ...picked]);
  }

  drop(event: DragEvent) {
    event.preventDefault();
    this.over.set(false);
    this.choose(event.dataTransfer?.files ?? null);
  }

  remove(index: number) { this.files.update(list => list.filter((_, i) => i !== index)); }

  start() {
    const doc = this.document();
    for (const file of this.files()) {
      this.uploader.add(file, {
        projectId: this.projectId(), documentId: doc?.id ?? null, title: doc?.title ?? titleFromFileName(file.name),
        kind: doc ? doc.kind : this.kind(), fileName: file.name, size: file.size, source: this.source.trim(), note: this.note.trim()
      });
    }
    this.started.emit();
    this.closed.emit();
  }
}
