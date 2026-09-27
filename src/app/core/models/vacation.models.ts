export interface VacationType {
  id: number;
  name: string;
  description: string;
  isPaid: boolean;
  paymentTypeAr: string;
}

export interface Vacation {
  id: number;
  vacationTypeName: string;
  userName: string;
  departmentName: string;
  branchName: string;
  status: string;
  statusAr: string;
  currentStage: string;
  isPaid: boolean;
  paymentStatusAr: string;
  managerAccept: boolean;
  branchManagerAccept: boolean;
  rejectionReason: string | null;
  rejectedByName: string | null;
  vacReason: string;
  vacDayCount: number;
  startVac: string;
  endVac: string;
  createdAt: string;
}
