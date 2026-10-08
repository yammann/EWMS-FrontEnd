export interface VacationType {
  id: number;
  name: string;
  description: string;
  isPaid: boolean;
  paymentTypeAr: string;
}

export interface Vacation {
  id: number;
  requestNumber: string;
  userId: number;
  vacationTypeId: number;
  vacationTypeName: string;
  userName: string;
  departmentName: string;
  branchName: string;
  status: string;
  statusAr: string;
  currentStage: string;
  /** الدفع يُحدَّد عند الاعتماد النهائي فقط — قبله paidDays/unpaidDays صفر */
  paymentDecided: boolean;
  isPaid: boolean;
  paidDays: number;
  unpaidDays: number;
  paymentStatusAr: string;
  segments: VacationSegment[];
  firstApprovedByName: string | null;
  firstApprovedAt: string | null;
  finalApprovedByName: string | null;
  finalApprovedAt: string | null;
  managerAccept: boolean;
  branchManagerAccept: boolean;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  vacReason: string;
  /** أيام العمل (بلا جمعة ولا عطل رسمية) */
  vacDayCount: number;
  calendarDays: number;
  startVac: string;
  endVac: string;
  createdAt: string;
  /** مرفقات الطلب (بيانات وصفية؛ المحتوى من Vacations/Attachment/{id}) */
  attachments: VacationAttachment[];
}

export interface VacationAttachment { id: number; fileName: string; contentType: string; size: number; }

/** قواعد المرفقات — مطابقة لـ VacationAttachmentRules في الباك (عدّلهما معاً) */
export const VACATION_ATTACHMENTS = {
  maxFiles: 3,
  maxBytes: 5 * 1024 * 1024,
  accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  types: ['application/pdf', 'image/jpeg', 'image/png']
} as const;

export interface VacationSegment { startDate: string; endDate: string; isPaid: boolean; days: number; }

export interface PublicHoliday { id: number; date: string; name: string; isFriday: boolean; }

/** معاينة المدة في نموذج الطلب */
export interface VacationDaysPreview { calendarDays: number; workingDays: number; fridays: number; holidays: PublicHoliday[]; }

/** نموذج طلب الإجازة الورقي (GET Vacations/Print/{id}) */
export interface VacationPrint {
  vacation: Vacation;
  submittedHijri: string;
  submittedAt: string;
  employeeName: string;
  personalIdNumber: string | null;
  phone: string | null;
  departmentName: string;
  branchName: string;
  types: { id: number; name: string; selected: boolean }[];
  /** null = لم يُقرَّر بعد */
  branchOpinion: string | null;
  signerName: string | null;
  signerSignature: string | null;
}

/** «سجل الموظف» قبل القرار (GET Vacations/ApprovalContext/{id}) */
export interface VacationContextItem {
  id: number; userName: string; vacationTypeName: string;
  startVac: string; endVac: string; vacDayCount: number; status: string; statusAr: string;
}
export interface VacationApprovalContext {
  lastVacation: VacationContextItem | null;
  /** 0 = في إجازة الآن */
  daysSinceLastVacation: number | null;
  /** إجازات معتمدة لم تبدأ بعد (الأقرب أولاً) */
  upcomingApproved: VacationContextItem[];
  monthApprovedCount: number;
  monthApprovedDays: number;
  projectedWorkingDays: number;
  projectedPaidDays: number;
  projectedUnpaidDays: number;
  typeIsPaid: boolean;
  maxPaidDaysPerMonth: number;
  monthlyQuota: { year: number; month: number; paidUsed: number }[];
  departmentName: string;
  departmentActiveUsers: number;
  colleaguesOnLeave: VacationContextItem[];
  colleaguesOnLeaveCount: number;
  otherPending: VacationContextItem[];
}
