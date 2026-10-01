import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

/** Organization = كل المؤسسة (id = 0) */
export type ModuleUnitType = 'Organization' | 'Branch' | 'Department' | 'Office';

export interface ModuleUnit {
  type: ModuleUnitType;
  id: number;
  name: string;
  /** المسار فوق الوحدة: "الفرع التقني / قسم العمليات" (فارغ للفرع) */
  path: string;
}

/** خدمة (وحدة عمل) والوحدات التنظيمية التي تملكها */
export interface AppModule {
  key: string;
  name: string;
  description: string;
  units: ModuleUnit[];
}

/** علاقتي بخدمة: عضو في وحدة تملكها / رئيسها / مطّلع (رئيس فرعها أو مدير النظام) */
export interface MyModule {
  key: string;
  isMember: boolean;
  isHead: boolean;
  isOverseer: boolean;
}

/**
 * إسناد الخدمات (الصيانة، توثيق الأجهزة...) للفروع والأقسام والمكاتب التي تملكها —
 * مطابق لـ Application/Common/AppModules في الباكاند.
 */
@Injectable({ providedIn: 'root' })
export class ModuleService {
  private api = inject(ApiService);

  all() { return this.api.get<AppModule[]>('/Modules/GetAll'); }

  /** يستبدل وحدات الخدمة بالقائمة المرسلة ويعيد كل الخدمات */
  assign(key: string, units: Pick<ModuleUnit, 'type' | 'id'>[]) {
    return this.api.put<AppModule[]>(`/Modules/Assign/${key}`, units.map(u => ({ type: u.type, id: u.id })));
  }

  mine() { return this.api.get<MyModule[]>('/Modules/My'); }
}
