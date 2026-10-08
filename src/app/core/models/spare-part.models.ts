/** مرجع مختصر: معرّف واسم */
export interface NamedRef { id: number; name: string; }

/** قطعة غيار في مخزون قسم — الكمية والمتوسط يتغيّران بالحركات فقط */
export interface SparePart {
  id: number;
  departmentId: number;
  departmentName: string;
  name: string;
  partNumber: string;
  unit: string;
  description: string;
  quantity: number;
  minQuantity: number;
  /** متوسط مرجّح لأسعار الإدخال (ل.س) */
  averageCost: number;
  stockValue: number;
  /** تحت الحد الأدنى */
  isLow: boolean;
  deviceTypes: NamedRef[];
  deviceCompanies: NamedRef[];
  createdAt: string;
  updatedAt: string;
}

export interface SparePartInput {
  /** قسم المخزون عند الإنشاء لمن يدير أكثر من قسم */
  departmentId?: number | null;
  name: string;
  partNumber: string;
  unit: string;
  description: string;
  minQuantity: number;
  deviceTypeIds: number[];
  deviceCompanyIds: number[];
}

export interface SparePartFilter {
  search?: string;
  departmentId?: number | null;
  deviceTypeId?: number | null;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

/** 1 إدخال، 2 صرف، 3 إرجاع، 4 تسوية — الكمية موجبة للداخل وسالبة للخارج */
export interface SparePartMovement {
  id: number;
  type: 1 | 2 | 3 | 4;
  typeAr: string;
  quantity: number;
  unitCost: number;
  balanceAfter: number;
  date: string;
  note: string;
  maintenanceRequestId: number | null;
  requestNumber: string | null;
  userName: string;
  createdAt: string;
}

/** قطعة مصروفة على طلب — السعر مثبَّت لحظة الصرف */
export interface RequestPart {
  id: number;
  sparePartId: number;
  partName: string;
  partNumber: string;
  unit: string;
  quantity: number;
  unitCost: number;
  total: number;
  issuedByName: string;
  issuedAt: string;
}

export interface RequestParts {
  items: RequestPart[];
  total: number;
  /** تكلفة قطع الجهاز في كل طلباته */
  deviceLifetimeCost: number;
  replacementCostThreshold: number | null;
  overThreshold: boolean;
  canIssue: boolean;
}

export interface SparePartUsage { sparePartId: number; name: string; unit: string; quantity: number; cost: number; }

export interface DeviceCost {
  deviceMaintenanceId: number;
  serialNumber: string;
  deviceName: string;
  deviceTypeName: string;
  requestsCount: number;
  cost: number;
  threshold: number | null;
  overThreshold: boolean;
}

export interface SparePartReport {
  from: string;
  to: string;
  partsCount: number;
  lowStockCount: number;
  stockValue: number;
  issuedCost: number;
  mostUsed: SparePartUsage[];
  deviceCosts: DeviceCost[];
}

/** مبلغ بالليرة السورية بلا كسور زائدة: 12,500 ل.س */
export function money(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ل.س`;
}

/** كمية بخانتين عشريتين على الأكثر */
export function qty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** يقبل رقماً بخانتين عشريتين على الأكثر */
export function twoDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;   // 0.1 × 100 ليست 10 تماماً في الفاصلة العائمة
}
