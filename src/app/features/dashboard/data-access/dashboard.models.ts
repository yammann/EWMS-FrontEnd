// تطابق Application/DTOs/Response/DashboardResponseDtos.cs
// لوحات المتابعة = إحصائيات عامة للمؤسسة. الإجازات لها صفحة مستقلة (VacationStats).

export interface DashboardCountItem {
  label: string;
  count: number;
  days: number;
}

export type DashboardActivityType = 'UserJoined';

export interface DashboardActivity {
  type: DashboardActivityType;
  icon: string;
  text: string;
  scope: string;
  date: string;
}

export interface BranchSummary {
  id: number;
  name: string;
  managerNames: string;
  departmentsCount: number;
  officesCount: number;
  employeesCount: number;
}

export interface OverviewDashboard {
  branchesCount: number;
  departmentsCount: number;
  officesCount: number;
  employeesCount: number;
  branches: BranchSummary[];
  employeesByRole: DashboardCountItem[];
  recentActivity: DashboardActivity[];
}

export interface DepartmentSummary {
  id: number;
  name: string;
  managerNames: string;
  officesCount: number;
  employeesCount: number;
}

export interface BranchDashboard {
  branchId: number;
  branchName: string;
  managerNames: string;
  departmentsCount: number;
  officesCount: number;
  employeesCount: number;
  departments: DepartmentSummary[];
  employeesByRole: DashboardCountItem[];
  recentActivity: DashboardActivity[];
}

export interface OfficeSummary {
  id: number;
  name: string;
  managerNames: string;
  employeesCount: number;
}

export interface DepartmentDashboard {
  departmentId: number;
  departmentName: string;
  branchId: number;
  branchName: string;
  managerNames: string;
  officesCount: number;
  employeesCount: number;
  offices: OfficeSummary[];
  recentActivity: DashboardActivity[];
}

export interface OfficeMember {
  userId: number;
  fullName: string;
  roleName: string;
  email: string;
  joinedAt: string;
}

export interface OfficeDashboard {
  officeId: number;
  officeName: string;
  departmentId: number;
  departmentName: string;
  branchId: number;
  branchName: string;
  managerNames: string;
  employeesCount: number;
  members: OfficeMember[];
  recentActivity: DashboardActivity[];
}

export interface TeamMember {
  fullName: string;
  roleName: string;
  email: string;
}

export interface EmployeeDashboard {
  fullName: string;
  roleName: string;
  branchName: string;
  departmentName: string;
  officeName: string;
  joinedAt: string;
  canRequestVacation: boolean;
  paidDaysLimitPerMonth: number;
  paidDaysLeftThisMonth: number;
  teamName: string;
  team: TeamMember[];
}

// ════════════════════ صفحة إحصائيات الإجازات ════════════════════

export interface DashboardVacationRow {
  id: number;
  employeeName: string;
  departmentName: string;
  officeName: string;
  vacationTypeName: string;
  startVac: string;
  endVac: string;
  vacDayCount: number;
  status: string;
  statusAr: string;
  isPaid: boolean;
  paidDays: number;
  unpaidDays: number;
  paymentStatusAr: string;
}

export interface DashboardAction {
  vacationId: number;
  employeeName: string;
  departmentName: string;
  actionType: 'Submitted' | 'Forwarded' | 'Approved' | 'Rejected' | 'Cancelled' | 'Unknown';
  action: string;
  byName: string | null;
  date: string;
}

export interface VacationStats {
  scopeType: 'All' | 'Branch' | 'Department' | 'Office';
  scopeName: string;
  onLeaveToday: number;
  upcomingLeavesCount: number;
  pendingRequests: number;
  approvedDaysThisMonth: number;
  pendingStageLabel: string;
  pendingApprovals: DashboardVacationRow[];
  onLeave: DashboardVacationRow[];
  recentActions: DashboardAction[];
  vacationsByType: DashboardCountItem[];
}
