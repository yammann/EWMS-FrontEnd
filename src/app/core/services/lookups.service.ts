import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { Branch, Department, Office, Role } from '@core/models/ewms.models';

type Kind = 'branches' | 'departments' | 'offices' | 'roles';

/** مدة بقاء القوائم المخزّنة (تُتجاوز بـ force عند «تحديث» وتُبطَل بعد أي تعديل) */
const TTL_MS = 60_000;

/**
 * قوائم الهيكل التنظيمي المشتركة بين الصفحات (فروع/أقسام/مكاتب/أدوار): جلب واحد يُعاد استعماله بين صفحات الإدارة
 * والنماذج بدل جلبها مع كل فتح صفحة. خدمات الإدارة تستدعي invalidate() بعد كل إنشاء/تعديل/حذف.
 */
@Injectable({ providedIn: 'root' })
export class LookupsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private cache = new Map<Kind, { at: number; data$: Observable<unknown> }>();

  branches(force = false) { return this.cached<Branch[]>('branches', '/Branches/GetAll', force); }
  departments(force = false) { return this.cached<Department[]>('departments', '/Department/GetAll', force); }
  offices(force = false) { return this.cached<Office[]>('offices', '/Offices/GetAll', force); }
  roles(force = false) { return this.cached<Role[]>('roles', '/Roles/GetAll', force); }

  /**
   * فروع للقوائم المنسدلة: Branches/GetAll يتطلب ViewBranches (غير متاحة لكل الأدوار)،
   * فنستخرج الفروع من الأقسام (Department/GetAll) لمن لا يملكها.
   */
  branchOptions(force = false): Observable<Branch[]> {
    if (this.auth.hasPermission(AppPermission.ViewBranches)) return this.branches(force);
    return this.departments(force).pipe(map(departments => {
      const branches = new Map<number, Branch>();
      for (const d of departments) {
        if (!branches.has(d.branchId)) branches.set(d.branchId, { id: d.branchId, name: d.branchName, description: '' });
      }
      return [...branches.values()];
    }));
  }

  /** إبطال القوائم (الكل إن لم تُحدَّد) — يُستدعى بعد أي تعديل على الهيكل أو الأدوار */
  invalidate(...kinds: Kind[]) {
    if (!kinds.length) this.cache.clear();
    else kinds.forEach(k => this.cache.delete(k));
  }

  private cached<T>(kind: Kind, path: string, force: boolean): Observable<T> {
    const hit = this.cache.get(kind);
    if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.data$ as Observable<T>;
    const data$ = this.api.get<T>(path).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    const entry = { at: Date.now(), data$ };
    this.cache.set(kind, entry);
    // فشل الجلب لا يُخزَّن: الطلب التالي يعيد المحاولة
    return data$.pipe(tap({ error: () => { if (this.cache.get(kind) === entry) this.cache.delete(kind); } }));
  }
}
