import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';

/** موقع في قوائم الاختيار (المحافظة يحسبها الخادم من الإحداثيات) */
export interface SiteOption { id: number; name: string; governorateCode: string; governorateName: string; }

/**
 * سجل المواقع المشترك لقوائم الاختيار في الميزات الأخرى (رابط مهمة بموقع، موقع طلب دراسة…) —
 * تحتاج صلاحية قراءة السجل (سياسة AnySiteView)؛ من لا يملكها يحصل على 403 فيُخفي النموذج الحقل.
 * إدارة المواقع نفسها (إنشاء وتعديل وحذف وتركيبات) في ميزة devices.
 */
@Injectable({ providedIn: 'root' })
export class SiteLookupService {
  private api = inject(ApiService);

  all() { return this.api.get<SiteOption[]>('/Sites/GetAll'); }
}
