// توثيق الأجهزة: المنطقة ← الموقع ← (التركيب) ← الجهاز — تطابق DTOs الباكاند (Region/Site/Device/DeviceSite)

export interface Region {
  id: number;
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Site {
  id: number;
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  regionId: number;
  regionName: string;
}

export interface Device {
  id: number;
  name: string;
  model: string;
  description: string;
}

/** تركيب جهاز في موقع مع بيانات الاتصال */
export interface DeviceSite {
  id: number;
  deviceId: number;
  deviceName: string;
  deviceModel: string;
  siteId: number;
  siteName: string;
  regionId: number;
  regionName: string;
  ip: string;
  subnetMask: string;
  userName: string;
  pass: string;
  note: string;
  /** الرقم التسلسلي للقطعة المركّبة (الجهاز نوع قابل للتكرار) */
  sn: string;
  /** وصف دقيق لمكان التركيب داخل الموقع (مثل: عند البوابة الرئيسية) */
  installLocation: string;
}

export interface DeviceAccess {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** يملك أي عملية تعديل (إضافة أو تعديل أو حذف) */
  canManage: boolean;
  /** من قسم العمليات نفسه — قسم "توثيق الأجهزة" يظهر في لوحته فقط عندها */
  inOwnerDepartment: boolean;
}

// ════════════════════ خريطة الفرع (GET api/Map/Branch/{id}) ════════════════════

export interface MapRegion {
  id: number;
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  sitesCount: number;
  installationsCount: number;
}

export interface MapSite {
  id: number;
  name: string;
  description: string;
  regionId: number;
  regionName: string;
  latitude: number | null;
  longitude: number | null;
  installationsCount: number;
  deviceTypesCount: number;
}

export interface DevicesMapLayer {
  title: string;
  regions: MapRegion[];
  sites: MapSite[];
  regionsWithoutCoordinates: number;
  sitesWithoutCoordinates: number;
}

export interface MapBranchOption { id: number; name: string; hasMapData: boolean; }

/** طبقات بيانات الخريطة حسب الفرع — devicesLayer = null إن لم تكن للفرع بيانات خريطة بعد */
export interface BranchMap {
  branchId: number;
  branchName: string;
  devicesLayer: DevicesMapLayer | null;
}
