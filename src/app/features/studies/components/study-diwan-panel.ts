import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { localDateInput } from '@core/utils/format';
import { saveBlob } from '@core/utils/download';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import {
  StudyDiwanCase, StudyDiwanDecision, StudyDiwanReply, StudyDiwanReviewAction, StudyRecommendation, StudyResponse
} from '../data-access/studies.models';
import { SearchSelect, SelectOption } from '@shared/ui/search-select';

type DiwanAction = 'dispatch' | 'reply' | 'confirm' | 'return';

const TITLES: Record<DiwanAction, string> = {
  dispatch: 'تسجيل الصادر إلى الديوان المركزي',
  reply: 'تسجيل كتاب الرد المركزي',
  confirm: 'إجراء رئيس الفرع على الكتاب المركزي',
  return: 'إعادة المعاملة إلى ديوان الدراسات للتصحيح'
};

@Component({
  selector: 'app-study-diwan-panel',
  imports: [SearchSelect, SelectOption, DatePipe, Alert, FormActions, Modal],
  templateUrl: './study-diwan-panel.html',
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  styles: [`
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .table-wrap { margin-top: 16px; }
    .panel-heading p { margin-bottom: 8px; }
  `]
})
export class StudyDiwanPanel {
  private service = inject(StudyDocumentsService);

  response = input.required<StudyResponse>();
  diwan = input.required<StudyDiwanCase>();
  /** إجراء يُفتح تلقائياً مرة واحدة إن كان متاحاً (من قائمة معاملات الديوان) */
  openAction = input<string | null>(null);
  private autoOpened = false;

  constructor() {
    effect(() => {
      const wanted = this.openAction();
      const d = this.diwan();
      if (this.autoOpened || !wanted) return;
      const allowed = (wanted === 'dispatch' && d.canRegisterDispatch) || (wanted === 'reply' && d.canRegisterReply)
        || (wanted === 'confirm' && d.canReview);
      if (!allowed) return;
      this.autoOpened = true;
      untracked(() => this.open(wanted as DiwanAction));
    });
  }
  saved = output<StudyResponse>();
  startOrder = output<void>();

  action = signal<DiwanAction | null>(null);
  number = signal('');
  date = signal('');
  decision = signal<StudyDiwanDecision | null>(null);
  file = signal<File | null>(null);
  note = signal('');
  saving = signal(false);
  error = signal('');
  downloading = signal(false);
  downloadError = signal('');
  decisions = StudyDiwanDecision;
  titles = TITLES;

  latest = computed(() => this.diwan().replies[0]);
  canRefer = computed(() => this.latest()?.decision === StudyDiwanDecision.Approved &&
    this.response().recommendation !== StudyRecommendation.NotAvailable);
  confirmLabel = computed(() => this.canRefer() ? 'إحالة إلى إدارة المشاريع'
    : this.latest()?.decision === StudyDiwanDecision.Rejected ? 'إعادة الرد إلى القسم المتابع للتعديل'
      : 'إثبات الاطلاع وإغلاق المعاملة');
  valid = computed(() => {
    switch (this.action()) {
      case 'dispatch': return Boolean(this.number().trim() && this.date());
      case 'reply': return Boolean(this.number().trim() && this.date() && this.decision() && this.file());
      case 'return': return Boolean(this.note().trim());
      case 'confirm': return true;
      default: return false;
    }
  });

  open(action: DiwanAction) {
    const reply = action === 'reply' ? this.latest() : undefined;
    this.error.set('');
    this.number.set(reply?.number ?? '');
    this.date.set(reply?.date ?? localDateInput());
    this.decision.set(reply?.decision ?? null);
    this.file.set(null);
    this.note.set('');
    this.action.set(action);
  }

  pickFile(input: HTMLInputElement) { this.file.set(input.files?.[0] ?? null); }

  download(reply: StudyDiwanReply) {
    if (this.downloading()) return;
    trackRequest(this.service.diwanReplyFile(this.response().id, reply.id), this.downloading, this.downloadError,
      blob => saveBlob(blob, reply.fileName));
  }

  save() {
    const action = this.action();
    if (this.saving() || !this.valid() || !action) return;
    const { id, rowVersion } = this.response();
    const reference = { number: this.number().trim(), date: this.date(), rowVersion };
    const request = action === 'dispatch' ? this.service.registerDiwanDispatch(id, reference)
      : action === 'reply' ? this.service.registerDiwanReply(id, reference, this.decision()!, this.file()!)
        : this.service.reviewDiwanReply(id, action === 'confirm' ? StudyDiwanReviewAction.Confirm : StudyDiwanReviewAction.ReturnForCorrection,
          this.note().trim(), rowVersion);
    trackRequest(request, this.saving, this.error, response => {
      this.action.set(null);
      this.saved.emit(response);
    });
  }
}
