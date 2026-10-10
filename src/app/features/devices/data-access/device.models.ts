// توثيق الأجهزة: الموقع (يتبع محافظة ثابتة تُحدَّد من إحداثياته) ← (التركيب) ← الجهاز — تطابق DTOs الباكاند
// (Application/DTOs/Response/DeviceInventoryResponseDtos.cs). rowVersion يُعاد كما وصل عند التعديل (منع محو تعديل الآخرين).

export interface Site {
  id: number;
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  /** رمز المحافظة SYxx — يحدده الخادم من الإحداثيات */
  governorateCode: string;
  governorateName: string;
  contactName: string;
  contactPhone: string;
  responsibleParty: string;
  installationsCount: number;
  activeInstallationsCount: number;
  rowVersion: string;
}

export interface Device {
  id: number;
  name: string;
  model: string;
  description: string;
  category: string;
  manufacturer: string;
  installationsCount: number;
  rowVersion: string;
}

/** 1 يعمل، 2 معطّل، 3 أُزيل */
export type InstallationStatus = 1 | 2 | 3;

export const INSTALLATION_STATUSES: { value: InstallationStatus; label: string; tone: 'ok' | 'warn' | 'off' }[] = [
  { value: 1, label: 'يعمل', tone: 'ok' },
  { value: 2, label: 'معطّل', tone: 'warn' },
  { value: 3, label: 'أُزيل', tone: 'off' }
];

/** فئات مقترحة للكتالوج (النص حر) */
export const DEVICE_CATEGORIES = ['كاميرا', 'مسجّل (NVR/DVR)', 'سويتش', 'راوتر', 'نقطة وصول لاسلكية', 'جهاز بصمة', 'خادم', 'طابعة', 'UPS'];

/** تركيب جهاز في موقع — بلا كلمة السر (تُجلب منفصلة بصلاحية الإظهار ويُسجَّل كل إظهار) */
export interface DeviceSite {
  id: number;
  deviceId: number;
  deviceName: string;
  deviceModel: string;
  deviceCategory: string;
  siteId: number;
  siteName: string;
  governorateCode: string;
  governorateName: string;
  ip: string;
  subnetMask: string;
  gateway: string;
  userName: string;
  hasPassword: boolean;
  note: string;
  /** الرقم التسلسلي للقطعة المركّبة (الجهاز نوع قابل للتكرار) */
  sn: string;
  /** وصف دقيق لمكان التركيب داخل الموقع (مثل: عند البوابة الرئيسية) */
  installLocation: string;
  macAddress: string;
  port: string;
  vlan: number | null;
  firmware: string;
  installDate: string | null;
  lastVerifiedAt: string | null;
  status: InstallationStatus;
  statusAr: string;
  /** تركيب آخر بنفس الـ IP في نفس الموقع (تنبيه فقط) */
  duplicateIp: boolean;
  rowVersion: string;
}

export interface InstallationFilter {
  q?: string;
  governorateCode?: string | null;
  siteId?: number | null;
  deviceId?: number | null;
  status?: number | null;
  page?: number;
  pageSize?: number;
}

export interface IpInUse { id: number; deviceName: string; installLocation: string; }

/** 1 أضاف، 2 عدّل، 3 حذف، 4 أظهر كلمة السر، 5 نسخها، 6 تحقق، 7 استيراد */
export interface DeviceInventoryLog {
  id: number;
  action: number;
  actionAr: string;
  title: string;
  details: string;
  userName: string;
  createdAt: string;
}

export interface ImportReport {
  dryRun: boolean;
  total: number;
  valid: number;
  imported: number;
  newDevices: string[];
  rows: { row: number; ok: boolean; site: string; device: string; ip: string; message: string }[];
}

export interface DeviceAccess {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** يملك أي عملية تعديل (إضافة أو تعديل أو حذف) */
  canManage: boolean;
  /** يظهر كلمات سر الأجهزة وينسخها (RevealDevicePasswords) */
  canRevealPasswords: boolean;
}

// ════════════════════ خريطة الفرع (GET api/Map/Branch/{id}) ════════════════════


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
}

export interface DevicesMapLayer {
  title: string;
  sites: MapSite[];
  sitesWithoutCoordinates: number;
}

export interface MapBranchOption { id: number; name: string; hasMapData: boolean; }

/** طبقات بيانات الخريطة حسب الفرع — devicesLayer = null إن لم تكن للفرع بيانات خريطة بعد */
export interface BranchMap {
  branchId: number;
  branchName: string;
  devicesLayer: DevicesMapLayer | null;
}
