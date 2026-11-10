import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { BranchMap, MapBranchOption } from './map.models';

/** خريطة الفروع: الفروع التي يراها المستخدم عليها، وطبقات فرع واحد (الموقع مشترك بين الطبقات والمصادر) */
@Injectable({ providedIn: 'root' })
export class MapService {
  private api = inject(ApiService);

  branchMap(branchId: number) { return this.api.get<BranchMap>(`/Map/Branch/${branchId}`); }
  mapBranches() { return this.api.get<MapBranchOption[]>('/Map/Branches'); }
}
