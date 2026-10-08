import { computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

const SIZE_KEY = 'ewms_page_size';

function savedSize(fallback: number, sizes: number[]): number {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    return sizes.includes(n) ? n : fallback;
  } catch { return fallback; }
}

export interface PaginationOptions {
  /** حجم الصفحة الافتراضي (يُستبدل بما اختاره المستخدم وحُفظ في المتصفح) */
  size?: number;
  sizes?: number[];
  /** اسم معامل الرابط (?page=2) لحفظ الصفحة مع التحديث والرجوع؛ بدونه تبقى الحالة في الذاكرة فقط */
  urlKey?: string;
}

/**
 * تقسيم صفحات في الواجهة لقائمة محمّلة كاملة (قرار المستخدم 2026-10-08: تقسيم الصفحات في المشروع كله).
 * يُنشأ في سياق الحقن (حقل في الكلاس). المصدر دالة تعيد المصفوفة الحالية (عادةً computed بعد الفلاتر):
 *
 *   rows = new Pagination(() => this.filtered());
 *   // القالب: @for (r of rows.items(); …) …  <app-pager [page]="rows.page()" [pageSize]="rows.size()" [total]="rows.total()" (pageChange)="rows.go($event)" (sizeChange)="rows.setSize($event)" />
 *
 * الصفحة تُقصّ تلقائياً إن نقص العدد (حذف/تصفية)، ويرجع التقسيم إلى الصفحة 1 عند تغيّر الفلاتر باستدعاء reset().
 */
export class Pagination<T> {
  readonly sizes: number[];
  private requested = signal(1);
  private pageSize = signal(10);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly total = computed(() => this.source().length);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  /** الصفحة الفعلية بعد القصّ إلى المتاح */
  readonly page = computed(() => Math.min(Math.max(1, this.requested()), this.pages()));
  readonly items = computed(() => {
    const size = this.size(), start = (this.page() - 1) * size;
    return this.source().slice(start, start + size);
  });

  constructor(private source: () => T[], private options: PaginationOptions = {}) {
    this.sizes = options.sizes ?? [10, 25, 50];
    this.pageSize.set(savedSize(options.size ?? this.sizes[0], this.sizes));
    if (options.urlKey) {
      const initial = Number(this.route.snapshot.queryParamMap.get(options.urlKey));
      if (initial >= 1) this.requested.set(Math.floor(initial));
      effect(() => {
        if (this.total() === 0) return;            // أثناء التحميل لا نمسح الصفحة من الرابط
        const page = this.page();
        const current = Number(this.route.snapshot.queryParamMap.get(options.urlKey!)) || 1;
        if (page !== current) this.router.navigate([], { queryParams: { [options.urlKey!]: page > 1 ? page : null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    }
  }

  size = () => this.pageSize();
  go(page: number) { this.requested.set(page); }
  setSize(size: number) {
    this.pageSize.set(size); this.requested.set(1);
    try { localStorage.setItem(SIZE_KEY, String(size)); } catch { /* التفضيل اختياري */ }
  }
  reset() { this.requested.set(1); }
}

/** حجم الصفحة المحفوظ للقوائم المقسَّمة من الخادم (نفس تفضيل المستخدم) */
export function storedPageSize(fallback = 10, sizes = [10, 25, 50]): number { return savedSize(fallback, sizes); }
export function storePageSize(size: number) { try { localStorage.setItem(SIZE_KEY, String(size)); } catch { /* اختياري */ } }
