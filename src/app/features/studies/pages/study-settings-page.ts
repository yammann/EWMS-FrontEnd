import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { Pagination } from '@core/utils/pagination';
import { Alert } from '@shared/ui/alert';
import { CrudPage } from '@shared/ui/crud-page';
import { EmptyState } from '@shared/ui/empty-state';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { StudyAccess } from '../data-access/study-access';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import {
  LINKED_DOCUMENTS, StudyLinkedDocument, StudyLookup, StudyLookupInput, StudyStageType, StudyStageTypeInput
} from '../data-access/studies.models';

type SettingsKind = 'stageTypes' | 'attachmentTypes' | 'disciplines';
/** صف الجدول: القوائم البسيطة اسم + فعّال، وأنواع المراحل تزيد الترتيب والوزن والمستند المرتبط */
type SettingsRow = StudyLookup & Partial<Omit<StudyStageType, 'id' | 'name' | 'isActive'>>;
type SettingsBody = StudyStageTypeInput | StudyLookupInput;

const KINDS: Record<SettingsKind, { label: string; single: string; hint: string }> = {
  stageTypes: {
    label: 'أنواع المراحل', single: 'نوع مرحلة',
    hint: 'الأنواع الفعّالة تُنسخ إلى كل مشروع جديد بترتيبها ووزنها. النوع المرتبط بمستند (الطلب أو التكليف أو الرد أو أمر البدء) '
      + 'يُنشأ في المشروع مرحلةً مغلقة بتواريخ ذلك المستند. تعديل نوع لا يغيّر مراحل المشاريع الموجودة.'
  },
  attachmentTypes: { label: 'أنواع المرفقات', single: 'نوع مرفق', hint: 'يُختار نوع لكل ملف يُرفع على مستندات الدراسة ومشاريعها ومخططاتها.' },
  disciplines: { label: 'الاختصاصات الهندسية', single: 'اختصاص', hint: 'تُستعمل في تقدير الكادر في الرد، وفي مهندسي أمر البدء.' }
};
const KIND_KEYS = Object.keys(KINDS) as SettingsKind[];

/**
 * إعدادات فرع الدراسات: أنواع المراحل وأنواع المرفقات والاختصاصات الهندسية.
 * المستخدَم لا يُحذف (يرفضه الخادم برسالة) بل يُعطَّل: يبقى في السجلات القديمة ويختفي من النماذج الجديدة.
 */
@Component({
  selector: 'app-study-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Alert, EmptyState, Modal, FormActions, Pager, RowActions],
  templateUrl: './study-settings-page.html',
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  styles: [`
    .segmented { justify-self: start; flex-wrap: wrap; }
    .check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
    .check input { margin-top: 3px; }
    .check span { display: grid; gap: 2px; }
    .weight-sum { font-variant-numeric: tabular-nums; }
  `]
})
export class StudySettingsPage {
  private service = inject(StudyLookupsService);
  private router = inject(Router);

  can = inject(StudyAccess).can;
  kinds = KIND_KEYS;
  meta = KINDS;
  linkedDocuments = LINKED_DOCUMENTS;

  kind = signal<SettingsKind>('stageTypes');
  current = computed(() => KINDS[this.kind()]);
  isStage = computed(() => this.kind() === 'stageTypes');

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
    defaultOrder: [0, [Validators.required, Validators.min(0), Validators.max(1000)]],
    defaultWeight: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    linkedDocument: [0 as StudyLinkedDocument]
  });

  crud = new CrudPage<SettingsRow, SettingsBody>({
    // التبويب من الرابط: التحميل يبدأ عند قراءة ?tab=
    immediate: false,
    load: () => this.isStage() ? this.service.stageTypes() : this.service.lookup(this.kind() as Exclude<SettingsKind, 'stageTypes'>),
    create: body => this.send(body),
    update: (id, body) => this.send(body, id),
    remove: item => this.isStage() ? this.service.deleteStageType(item.id) : this.service.deleteLookup(this.simpleKind(), item.id),
    can: { create: () => this.can().createLookup, edit: () => this.can().editLookup, delete: () => this.can().deleteLookup },
    onOpen: item => this.form.reset({
      name: item?.name ?? '', isActive: item?.isActive ?? true,
      defaultOrder: item?.defaultOrder ?? this.nextOrder(), defaultWeight: item?.defaultWeight ?? 0,
      linkedDocument: item?.linkedDocument ?? 0
    }),
    messages: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'قوائم الدراسات',
      confirmDelete: item => `حذف «${item.name}» من ${this.current().label}؟ المستخدَم في سجلات لا يُحذف — عطّله بدلاً من ذلك.`
    }
  });
  pager = new Pagination(() => this.crud.items());

  /** مجموع أوزان أنواع المراحل الفعّالة: ما يأخذه مشروع جديد (للعلم — الخادم لا يشترط 100) */
  activeWeight = computed(() => this.crud.items().filter(i => i.isActive).reduce((sum, i) => sum + (i.defaultWeight ?? 0), 0));

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const tab = p.get('tab') as SettingsKind | null;
      this.kind.set(tab && KIND_KEYS.includes(tab) ? tab : 'stageTypes');
      this.crud.reload(true);
    });
  }

  setKind(kind: SettingsKind) {
    this.router.navigate([], { queryParams: { tab: kind === 'stageTypes' ? null : kind }, queryParamsHandling: 'merge' });
  }

  linkedLabel(value: number | undefined) { return LINKED_DOCUMENTS.find(d => d.value === value)?.label ?? '—'; }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body: SettingsBody = this.isStage()
      ? { name: v.name.trim(), isActive: v.isActive, defaultOrder: v.defaultOrder, defaultWeight: v.defaultWeight, linkedDocument: v.linkedDocument }
      : { name: v.name.trim(), isActive: v.isActive };
    this.crud.save(body);
  }

  private simpleKind() { return this.kind() as Exclude<SettingsKind, 'stageTypes'>; }

  private send(body: SettingsBody, id?: number): Observable<unknown> {
    if (this.isStage()) {
      const stage = body as StudyStageTypeInput;
      return id ? this.service.updateStageType(id, stage) : this.service.createStageType(stage);
    }
    return id ? this.service.updateLookup(this.simpleKind(), id, body) : this.service.createLookup(this.simpleKind(), body);
  }

  /** ترتيب مقترح لنوع جديد: بعد آخر نوع بعشرة (يترك مكاناً للإدراج بينها) */
  private nextOrder() {
    const max = Math.max(0, ...this.crud.items().map(i => i.defaultOrder ?? 0));
    return this.isStage() ? Math.min(1000, max + 10) : 0;
  }
}
