import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, finalize, switchMap } from 'rxjs';
import { ConfirmService } from './confirm.service';
import { errorMessage } from './error-message';
import { ToastService } from './toast.service';

export type CrudMode = 'create' | 'edit';

export interface CrudPageConfig<T extends { id: number }, B, R = unknown> {
  /** قراءة القائمة (تُعاد بصمت بعد كل حفظ — تبقى البيانات ظاهرة أثناءها) */
  load: () => Observable<T[]>;
  create?: (body: B) => Observable<R>;
  update?: (id: number, body: B, item: T) => Observable<R>;
  remove?: (item: T) => Observable<unknown>;
  /** صلاحيات العمليات (تُقرأ عند كل محاولة) */
  can?: { create?: () => boolean; edit?: () => boolean; delete?: () => boolean };
  /** تهيئة نموذج الصفحة عند فتح النافذة (null = إنشاء) */
  onOpen?: (item: T | null) => void;
  /** false = لا تحميل تلقائي عند الإنشاء (الصفحة تستدعي reload عندما يجهز مصدرها، مثل تبويب من الرابط) */
  immediate?: boolean;
  /** «تحديث» يدوي: إبطال أي تخزين قبل إعادة القراءة (مثل LookupsService.invalidate) */
  onRefresh?: () => void;
  messages: {
    /** رسالة نجاح الحفظ؛ دالة لرسائل تعتمد على النتيجة (مثل عدد الأيام المضافة) */
    saved: string | ((result: R, mode: CrudMode) => string);
    deleted: string;
    confirmDelete: (item: T) => string;
    /** نص زر التأكيد في نافذة الحذف */
    confirmLabel?: string;
    /** اسم الجمع لرسالة نقص الصلاحية: «لا تملك صلاحية إضافة الفروع» */
    plural?: string;
  };
}

/**
 * النمط الموحّد لصفحات الإدارة (قرار المستخدم 2026-10-10):
 * - القائمة: إعادة القراءة بعد الحفظ بصمت (بلا وميض «جارٍ التحميل»)، وخطأ التحميل في شريط الصفحة مع «إعادة المحاولة».
 * - الإضافة/التعديل في نافذة؛ خطأ الحفظ داخل النافذة (لا يضيع ما أدخله المستخدم)، والنجاح تنبيه عابر.
 * - الحذف بنافذة التأكيد الموحّدة، ومؤشر الانشغال على صف السجل وحده، ويُزال السجل محلياً بلا إعادة قراءة.
 * تُنشأ كحقل في المكوّن (سياق الحقن): `crud = new CrudPage<Item, Body>({...})`.
 */
export class CrudPage<T extends { id: number }, B, R = unknown> {
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  private readonly cfg: CrudPageConfig<T, B, R>;
  private readonly trigger = new Subject<void>();
  private readonly loadingNow = signal(false);

  /** آخر قائمة ناجحة (تبقى أثناء إعادة القراءة وبعد فشلها)، وقابلة للتعديل المحلي */
  readonly items = signal<T[]>([]);
  private readonly loaded = signal(false);
  /** أول تحميل فقط (لإظهار «جارٍ التحميل» حين لا توجد بيانات بعد) */
  readonly loading: Signal<boolean> = computed(() => this.loadingNow() && !this.loaded());
  /** أي تحميل جارٍ (لتعطيل زر «تحديث») */
  readonly busy: Signal<boolean> = this.loadingNow.asReadonly();
  readonly loadError = signal('');

  readonly dialog = signal<{ mode: CrudMode; item: T | null } | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly deletingId = signal<number | null>(null);

  constructor(cfg: CrudPageConfig<T, B, R>) {
    this.cfg = cfg;
    // switchMap: إعادة قراءة جديدة تُلغي السابقة فلا يصل رد قديم بعد أحدث
    this.trigger.pipe(
      switchMap(() => {
        this.loadingNow.set(true); this.loadError.set('');
        return cfg.load().pipe(
          catchError(e => { this.loadError.set(errorMessage(e, 'تعذر تحميل البيانات')); return EMPTY; }),
          finalize(() => this.loadingNow.set(false))
        );
      }),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe(list => { this.items.set(list); this.loaded.set(true); });
    if (cfg.immediate !== false) {
      this.loadingNow.set(true);
      queueMicrotask(() => this.trigger.next());
    }
  }

  /** «تحديث» يدوي */
  refresh() { this.cfg.onRefresh?.(); this.trigger.next(); }

  /** إعادة قراءة صامتة (بعد تغيير خارجي)؛ clear = مصدر مختلف (تبويب/سنة أخرى): تُفرَّغ القائمة ويظهر «جارٍ التحميل» */
  reload(clear = false) {
    if (clear) { this.items.set([]); this.loaded.set(false); }
    this.trigger.next();
  }

  openCreate() {
    if (this.cfg.can?.create && !this.cfg.can.create()) return this.deny('إضافة');
    this.formError.set('');
    this.cfg.onOpen?.(null);
    this.dialog.set({ mode: 'create', item: null });
  }

  openEdit(item: T) {
    if (this.cfg.can?.edit && !this.cfg.can.edit()) return this.deny('تعديل');
    this.formError.set('');
    this.cfg.onOpen?.(item);
    this.dialog.set({ mode: 'edit', item });
  }

  /** الإغلاق ممنوع أثناء الحفظ */
  close() { if (!this.saving()) this.dialog.set(null); }

  /** خطأ تحقق من جهة الصفحة قبل الإرسال (يظهر داخل النافذة) */
  fail(message: string) { this.formError.set(message); }

  save(body: B) {
    const d = this.dialog();
    if (!d || this.saving()) return;
    const request = d.mode === 'create' ? this.cfg.create?.(body) : this.cfg.update?.(d.item!.id, body, d.item!);
    if (!request) return;
    this.saving.set(true); this.formError.set('');
    request.subscribe({
      next: result => {
        this.saving.set(false);
        this.dialog.set(null);
        const m = this.cfg.messages.saved;
        this.toast.success(typeof m === 'function' ? m(result, d.mode) : m);
        this.trigger.next();
      },
      error: e => { this.saving.set(false); this.formError.set(errorMessage(e, 'تعذر الحفظ')); }
    });
  }

  async remove(item: T) {
    if (this.cfg.can?.delete && !this.cfg.can.delete()) return this.deny('حذف');
    if (!this.cfg.remove || this.deletingId() !== null) return;
    if (!await this.confirm.ask(this.cfg.messages.confirmDelete(item), this.cfg.messages.confirmLabel ?? 'حذف')) return;
    this.deletingId.set(item.id);
    this.cfg.remove(item).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.items.update(list => list.filter(x => x.id !== item.id));
        this.toast.success(this.cfg.messages.deleted);
        if (this.dialog()?.item?.id === item.id) this.dialog.set(null);
      },
      error: e => { this.deletingId.set(null); this.toast.error(errorMessage(e, 'تعذر الحذف')); }
    });
  }

  private deny(verb: string) {
    this.toast.show(`لا تملك صلاحية ${verb} ${this.cfg.messages.plural ?? 'هذه السجلات'}`, 'error');
  }
}
