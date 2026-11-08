import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Pagination } from '@core/utils/pagination';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { Icon, IconName } from '@shared/ui/icon';
import { Pager } from '@shared/ui/pager';
import { latestRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyActivityLog } from '../data-access/studies.models';

/** أيقونة كل إجراء (StudyLogAction): إنشاء، تعديل، إرسال، اعتماد، رفض، إلغاء، إغلاق مرحلة، حذف، إعادة فتح */
const ACTION_ICONS: Record<number, IconName> = {
  1: 'plus', 2: 'pencil', 3: 'forward', 4: 'checkmark', 5: 'xmark', 6: 'lock', 7: 'lock', 8: 'trash', 9: 'undo'
};
/** لون الشارة: اعتماد أخضر، رفض وحذف أحمر، إلغاء وإغلاق رمادي */
const ACTION_TONES: Record<number, string> = { 4: 'ok', 5: 'bad', 8: 'bad', 6: 'mute', 7: 'mute' };

/**
 * سجل الدراسة كلها (من الطلب حتى المشروع) مرتباً من الأحدث: كل سطر من فعل ومن فعله ومتى، مع التفاصيل
 * (أسباب الرفض والإلغاء والفروق في التعديل). الخادم يعيده كاملاً فيُقسَّم هنا. `reloadKey` يتغيّر فيُعاد التحميل
 * (بعد رفع مرفق أو توقيع). الصلاحية `ViewStudyActivityLog` يتحقق منها من يعرض المكوّن.
 */
@Component({
  selector: 'app-study-activity',
  standalone: true,
  imports: [DatePipe, UtcPipe, Alert, Icon, Pager],
  template: `
    <section class="panel">
      <div class="panel-heading">
        <div><h2>{{ heading() }}</h2><p>{{ subtitle() }}</p></div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="load()" [disabled]="loading()">تحديث</button>
      </div>
      <app-alert [message]="error()" retryLabel="إعادة المحاولة" (retry)="load()" />
      @if (loading() && !rows().length) {
        <p class="muted">جارٍ التحميل…</p>
      } @else if (!rows().length && !error()) {
        <p class="muted">لا أحداث بعد.</p>
      } @else {
        <ol class="log">
          @for (e of pager.items(); track e.id) {
            <li>
              <span class="dot tone-{{ tone(e) }}" aria-hidden="true"><app-icon [name]="icon(e)" [size]="14" /></span>
              <div class="body">
                <div class="head">
                  <strong>{{ e.title }}</strong>
                  <small class="tag">{{ e.entityTypeName }} · {{ e.actionName }}</small>
                </div>
                @if (e.details) { <p class="details">{{ e.details }}</p> }
                <small class="muted">{{ e.userName }} · {{ e.createdAt | utc | date:'yyyy/MM/dd — HH:mm' }}</small>
              </div>
            </li>
          }
        </ol>
        <app-pager [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" [sizes]="pager.sizes"
                   (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
      }
    </section>
  `,
  styles: [`
    .log { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 2px; }
    li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--separator); }
    li:last-child { border-bottom: 0; }
    .dot { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--fill); color: var(--ink-600); }
    .dot.tone-ok { background: var(--brand-100); color: var(--brand-700); }
    .dot.tone-bad { background: var(--danger-100); color: var(--danger-700); }
    .dot.tone-mute { background: var(--fill-strong); color: var(--ink-500); }
    .body { display: grid; gap: 3px; min-width: 0; }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
    .tag { color: var(--ink-500); font-size: 11.5px; }
    .details { margin: 0; font-size: 13px; color: var(--ink-700); white-space: pre-line; overflow-wrap: anywhere; }
  `]
})
export class StudyActivity {
  private service = inject(StudyDocumentsService);
  private latest = latestRequest();

  /** الطلب الجذر للدراسة (سجل واحد لكل السلسلة) */
  requestId = input.required<number>();
  /** يتغيّر فيُعاد التحميل (بعد رفع مرفق أو حذفه) */
  reloadKey = input<unknown>(0);
  /** عنوان اللوحة ووصفها (مثلاً سجل مخطط واحد بدل الدراسة كلها) */
  heading = input('سجل الدراسة');
  subtitle = input('كل ما جرى على مستندات الدراسة ومرفقاتها، من الأحدث إلى الأقدم.');
  /** تصفية الأحداث المعروضة (مثلاً أحداث مخطط ونسخه فقط)؛ بلا تصفية = كل السجل */
  filter = input<((e: StudyActivityLog) => boolean) | null>(null);

  private all = signal<StudyActivityLog[]>([]);
  rows = computed(() => { const f = this.filter(); return f ? this.all().filter(f) : this.all(); });
  loading = signal(false);
  error = signal('');
  pager = new Pagination(() => this.rows());

  icon = (e: StudyActivityLog): IconName => ACTION_ICONS[e.action] ?? 'note';
  tone = (e: StudyActivityLog) => ACTION_TONES[e.action] ?? 'plain';

  constructor() {
    effect(() => {
      this.requestId(); this.reloadKey();
      untracked(() => this.load());
    });
  }

  load() {
    this.latest(this.service.activityLog(this.requestId()), this.loading, this.error, list => this.all.set(list));
  }
}
