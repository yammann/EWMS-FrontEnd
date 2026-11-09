/** خريطة الفرع (GET api/Map/Branch/{id}): طبقات تُبنى من بيانات الفرع — نسخة من MapDto في الباكاند */

export interface MapSite {
  id: number;
  name: string;
  description: string;
  /** رمز المحافظة SYxx — يحدده الخادم من الإحداثيات */
  governorateCode: string;
  governorateName: string;
  latitude: number | null;
  longitude: number | null;
  installationsCount: number;
  deviceTypesCount: number;
  /** عدد سجلات الطبقة على الموقع (طبقات الفروع، kind = entries) */
  entriesCount: number;
  /** عدد عناصر الطبقة في الموقع بوحدتها (تركيبات، سجلات…) — العدد العام لكل الطبقات */
  count: number;
}

/** طبقة على خريطة الفرع — kind "devices" = المواقع التي فيها تركيبات مسجّلة باسم الفرع */
export interface MapLayer {
  key: string;
  /** 'devices' = تركيبات الأجهزة، 'entries' = طبقة يعرّفها الفرع */
  kind: 'devices' | 'entries' | string;
  title: string;
  /** #RRGGBB — فارغ = لون الواجهة */
  color: string;
  /** وحدة العدّ في الموقع: «تركيب»، «سجل»… */
  unit: string;
  sites: MapSite[];
  sitesWithoutCoordinates: number;
}

export interface MapBranchOption { id: number; name: string; hasMapData: boolean; }

/** خريطة الفرع: طبقات تُبنى من بياناته — layers فارغة إن لم تكن له بيانات بعد */
export interface BranchMap {
  branchId: number;
  branchName: string;
  layers: MapLayer[];
}
