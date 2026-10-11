import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { MAP_LAYER_ACCESS } from '@core/constants/access';

/** طبقات خرائط الفروع: لمن يدير الطبقات أو يعمل على سجلاتها (سياسة AnyMapLayerRead) — الحدود يطبّقها الخادم */
export const MAP_LAYERS_ROUTES: Routes = [
  { path: 'map-layers', canActivate: [permissionGuard], data: { anyPermission: MAP_LAYER_ACCESS }, loadComponent: () => import('./pages/map-layers-page').then(m => m.MapLayersPage) }
];
