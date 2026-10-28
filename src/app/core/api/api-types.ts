// ملف مولَّد من contract/openapi.json بالأمر `npm run api:types` — لا تعدّله يدوياً.
// شكل ما يرسله الخادم (الحقل بلا `| null` يُرسَل دائماً). عند تغيّر العقد يتغيّر هذا الملف في الـ commit نفسه فيراجعه إنسان.

export interface AddAssignedTaskCommentRequestDto {
  text: string;
}

export interface AddChecklistItemRequestDto {
  text: string;
}

export interface AddProjectMemberRequestDto {
  title: string | null;
  userId: number;
}

export interface AddTaskLinkRequestDto {
  entityId: number | null;
  entityType: string;
  reference: string | null;
}

export interface AddTaskToToDoListRequestDto {
  taskId: number;
}

export interface AddToDoItemRequestDto {
  color: string | null;
  dueDate: string | null;
  isImportant: boolean;
  note: string | null;
  repeat: number | null;
  title: string;
}

export interface AdjustSparePartDto {
  delta: number;
  reason: string;
}

export interface ApproveVacationRequestDto {
  approve: boolean;
  reason: string | null;
}

export interface AssignMaintenanceDto {
  userId: number;
}

export interface AssignedTaskActivityDto {
  createdAt: string;
  id: number;
  text: string;
  type: string;
  userName: string;
}

export interface AssignedTaskAttachmentDto {
  canDelete: boolean;
  contentType: string;
  fileName: string;
  id: number;
  size: number;
  taskId: number;
  uploadedAt: string;
  uploadedByName: string;
}

export interface AssignedTaskCardDto {
  allowedStatuses: string[];
  attachmentsCount: number;
  canChangeStatus: boolean;
  checklistDone: number;
  checklistTotal: number;
  claimedByName: string | null;
  claimedByUserId: number | null;
  commentsCount: number;
  completedAt: string | null;
  createdAt: string;
  createdByName: string;
  createdByUserId: number;
  dueDate: string | null;
  id: number;
  isOverdue: boolean;
  needsReturnNote: boolean;
  parentTaskId: number | null;
  parentTitle: string | null;
  priority: string;
  priorityAr: string;
  status: string;
  statusAr: string;
  subTasksDone: number;
  subTasksTotal: number;
  targetName: string;
  targetPath: string;
  targetType: string;
  title: string;
  updatedAt: string;
}

export interface AssignedTaskDetailDto {
  activities: AssignedTaskActivityDto[];
  allowedStatuses: string[];
  attachments: AssignedTaskAttachmentDto[];
  attachmentsCount: number;
  canAttach: boolean;
  canChangeStatus: boolean;
  canClaim: boolean;
  canComment: boolean;
  canDelegate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canManageChecklist: boolean;
  canRelease: boolean;
  checklist: ChecklistItemDto[];
  checklistDone: number;
  checklistTotal: number;
  claimedByName: string | null;
  claimedByUserId: number | null;
  commentsCount: number;
  completedAt: string | null;
  createdAt: string;
  createdByName: string;
  createdByUserId: number;
  description: string;
  dueDate: string | null;
  id: number;
  isOverdue: boolean;
  needsReturnNote: boolean;
  parentAttachments: AssignedTaskAttachmentDto[];
  parentTaskId: number | null;
  parentTitle: string | null;
  priority: string;
  priorityAr: string;
  reviewLocked: boolean;
  startedAt: string | null;
  status: string;
  statusAr: string;
  subTasks: AssignedTaskCardDto[];
  subTasksDone: number;
  subTasksTotal: number;
  targetName: string;
  targetPath: string;
  targetType: string;
  title: string;
  updatedAt: string;
}

export interface AuditLogResponseDto {
  action: string;
  createdAt: string;
  details: string;
  entityId: number | null;
  entityType: string;
  id: number;
  projectId: number | null;
  title: string;
  userId: number;
  userName: string;
}

export interface AuditLogResponseDtoPagedResultDto {
  items: AuditLogResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface BranchDashboardDto {
  branchId: number;
  branchName: string;
  departments: DepartmentSummaryDto[];
  departmentsCount: number;
  employeesByRole: DashboardCountItemDto[];
  employeesCount: number;
  employeesWithTasks: number;
  managerNames: string;
  officesCount: number;
  recentActivity: DashboardActivityDto[];
  taskDistribution: WorkTaskDistributionDto[];
  tasks: WorkTaskCardDto[];
  tasksCount: number;
}

export interface BranchMapDto {
  branchId: number;
  branchName: string;
  layers: MapLayerDto[];
}

export interface BranchResponseDto {
  description: string;
  id: number;
  name: string;
}

export interface BranchSummaryDto {
  departmentsCount: number;
  employeesCount: number;
  id: number;
  managerNames: string;
  name: string;
  officesCount: number;
  tasksCount: number;
}

export interface BulkAddToDoItemsRequestDto {
  titles: string[];
}

export interface ChangeAssignedTaskStatusRequestDto {
  expectedStatus: number | null;
  note: string | null;
  status: number;
}

export interface ChangeMaintenanceStatusDto {
  statusId: number;
}

export interface ChangeMyPasswordCommand {
  currentPassword: string;
  newPassword: string;
}

export interface ChecklistItemDto {
  id: number;
  isDone: boolean;
  text: string;
}

export interface ClaimAssignedTaskRequestDto {
  claim: boolean;
}

export interface ClassifyScheduleTaskRequestDto {
  isCritical: boolean;
  rowVersion: string | null;
}

export interface CreateAssignedTaskRequestDto {
  checklistItems: string[] | null;
  description: string;
  dueDate: string | null;
  parentTaskId: number | null;
  priority: number;
  targetId: number;
  targetType: string | null;
  title: string;
}

export interface CreateVacationTypeRequestDto {
  description: string;
  name: string;
}

export interface CreateWorkTaskRequestDto {
  branchId: number;
  description: string;
  icon: string;
  isActive: boolean;
  name: string;
  userIds: number[];
}

export interface DamageTypeRequestDto {
  description: string;
  name: string;
}

export interface DamageTypeResponseDto {
  description: string;
  id: number;
  name: string;
}

export interface DashboardActionDto {
  action: string;
  actionType: string;
  byName: string | null;
  date: string;
  departmentName: string;
  employeeName: string;
  vacationId: number;
}

export interface DashboardActivityDto {
  date: string;
  icon: string;
  scope: string;
  text: string;
  type: string;
}

export interface DashboardCountItemDto {
  count: number;
  days: number;
  label: string;
}

export interface DashboardVacationRowDto {
  departmentName: string;
  employeeName: string;
  endVac: string;
  id: number;
  isPaid: boolean;
  officeName: string;
  paidDays: number;
  paymentStatusAr: string;
  startVac: string;
  status: string;
  statusAr: string;
  unpaidDays: number;
  vacationTypeName: string;
  vacDayCount: number;
}

export interface DecideMaintenanceTransferDto {
  approve: boolean;
  note: string | null;
  userId: number | null;
}

export interface DepartmentDashboardDto {
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentName: string;
  employeesCount: number;
  employeesWithoutTasks: number;
  managerNames: string;
  offices: OfficeSummaryDto[];
  officesCount: number;
  recentActivity: DashboardActivityDto[];
  taskDistribution: WorkTaskDistributionDto[];
  tasksCount: number;
}

export interface DepartmentResponseDto {
  branchId: number;
  branchName: string;
  description: string;
  id: number;
  name: string;
}

export interface DepartmentSummaryDto {
  employeesCount: number;
  employeesWithTasks: number;
  id: number;
  managerNames: string;
  name: string;
  officesCount: number;
}

export interface DeviceCompanyRequestDto {
  description: string;
  name: string;
}

export interface DeviceCompanyResponseDto {
  description: string;
  id: number;
  name: string;
}

export interface DeviceCostDto {
  cost: number;
  deviceMaintenanceId: number;
  deviceName: string;
  deviceTypeName: string;
  requestsCount: number;
  serialNumber: string;
}

export interface DeviceInventoryLogDto {
  action: number;
  actionAr: string;
  createdAt: string;
  details: string;
  id: number;
  title: string;
  userName: string;
}

export interface DeviceInventoryLogDtoPagedResultDto {
  items: DeviceInventoryLogDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface DeviceMaintenanceRequestDto {
  description: string;
  deviceCompanyId: number;
  deviceTypeId: number;
  model: string;
  name: string;
  serialNumber: string;
}

export interface DeviceMaintenanceResponseDto {
  description: string;
  deviceCompanyId: number;
  deviceCompanyName: string;
  deviceTypeId: number;
  deviceTypeName: string;
  id: number;
  model: string;
  name: string;
  serialNumber: string;
}

export interface DeviceMaintenanceResponseDtoPagedResultDto {
  items: DeviceMaintenanceResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface DevicePasswordDto {
  password: string;
}

export interface DeviceRequestDto {
  category: string;
  description: string;
  manufacturer: string;
  model: string;
  name: string;
  rowVersion: string | null;
}

export interface DeviceResponseDto {
  category: string;
  description: string;
  id: number;
  installationsCount: number;
  manufacturer: string;
  model: string;
  name: string;
  rowVersion: string;
}

export interface DeviceSiteResponseDto {
  branchId: number | null;
  branchName: string;
  departmentId: number | null;
  departmentName: string;
  deviceCategory: string;
  deviceId: number;
  deviceModel: string;
  deviceName: string;
  duplicateIp: boolean;
  firmware: string;
  gateway: string;
  governorateCode: string;
  governorateName: string;
  hasPassword: boolean;
  id: number;
  installDate: string | null;
  installLocation: string;
  ip: string;
  lastVerifiedAt: string | null;
  macAddress: string;
  note: string;
  port: string;
  rowVersion: string;
  siteId: number;
  siteName: string;
  sn: string;
  status: number;
  statusAr: string;
  subnetMask: string;
  userName: string;
  vlan: number | null;
}

export interface DeviceSiteResponseDtoPagedResultDto {
  items: DeviceSiteResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface DeviceTypeRequestDto {
  name: string;
}

export interface DeviceTypeResponseDto {
  id: number;
  name: string;
}

export interface EmployeeDashboardDto {
  branchName: string;
  canRequestVacation: boolean;
  departmentName: string;
  fullName: string;
  joinedAt: string;
  officeName: string;
  paidDaysLeftThisMonth: number;
  paidDaysLimitPerMonth: number;
  roleName: string;
  team: TeamMemberDto[];
  teamName: string;
}

export interface ExtensionLineRequestDto {
  days: number;
  movesStart: boolean;
  taskId: number;
}

export interface FieldUsageDto {
  count: number;
}

export interface InstallationImportReportDto {
  dryRun: boolean;
  imported: number;
  newDevices: string[];
  rows: InstallationImportRowDto[];
  total: number;
  valid: number;
}

export interface InstallationImportRowDto {
  device: string;
  ip: string;
  message: string;
  ok: boolean;
  row: number;
  site: string;
}

export interface InstallationRequestDto {
  departmentId: number | null;
  deviceId: number;
  firmware: string;
  gateway: string;
  installDate: string | null;
  installLocation: string;
  ip: string;
  macAddress: string;
  note: string;
  pass: string;
  port: string;
  rowVersion: string | null;
  siteId: number;
  sn: string;
  status: number;
  subnetMask: string;
  userName: string;
  vlan: number | null;
}

export interface IpInUseDto {
  deviceName: string;
  id: number;
  installLocation: string;
}

export interface IssueSparePartDto {
  quantity: number;
  sparePartId: number;
}

export interface JustifyScheduleDelayRequestDto {
  actions: string | null;
  affectedTaskIds: number[];
  affectsCriticalWork: boolean;
  approvalAuthority: string | null;
  approvalDate: string | null;
  approvalDocumentVersionId: number | null;
  reason: string | null;
  rowVersion: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MaintenanceActivityDto {
  createdAt: string;
  id: number;
  text: string;
  type: number;
  userId: number;
  userName: string;
}

export interface MaintenanceClientDto {
  departmentName: string;
  fullName: string;
  id: number;
  phone: string | null;
}

export interface MaintenanceCountDto {
  color: string | null;
  count: number;
  id: number;
  name: string;
}

export interface MaintenanceMonthDto {
  count: number;
  month: number;
  year: number;
}

export interface MaintenancePrintDto {
  delivered: boolean;
  deliveredAt: string | null;
  managerName: string;
  managerSignature: string | null;
  request: MaintenanceRequestResponseDto;
}

export interface MaintenanceRequestPartDto {
  id: number;
  issuedAt: string;
  issuedByName: string;
  partName: string;
  partNumber: string;
  quantity: number;
  sparePartId: number;
  total: number;
  unit: string;
  unitCost: number;
}

export interface MaintenanceRequestResponseDto {
  accessories: string;
  canAssign: boolean;
  canChangeStatus: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canRequestTransfer: boolean;
  clientDepartmentName: string;
  clientName: string;
  clientPhone: string;
  clientUserId: number | null;
  completedAt: string | null;
  createdAt: string;
  damageTypeId: number;
  damageTypeName: string;
  departmentId: number | null;
  departmentName: string;
  description: string;
  deviceCompanyId: number;
  deviceCompanyName: string;
  deviceMaintenanceId: number;
  deviceName: string;
  deviceTypeId: number;
  deviceTypeName: string;
  id: number;
  isClosed: boolean;
  maintenanceRequestStatusId: number;
  model: string;
  number: string;
  serialNumber: string;
  startedAt: string | null;
  statusColor: string;
  statusName: string;
  statusStage: number;
  technicianName: string;
  updatedAt: string;
  userId: number;
}

export interface MaintenanceRequestResponseDtoPagedResultDto {
  items: MaintenanceRequestResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface MaintenanceRequestStatusRequestDto {
  color: string;
  name: string;
  stage: number;
}

export interface MaintenanceRequestStatusResponseDto {
  color: string;
  id: number;
  name: string;
  stage: number;
}

export interface MaintenanceStatsDto {
  averageRepairHours: number | null;
  byCompany: MaintenanceCountDto[];
  byDamageType: MaintenanceCountDto[];
  byDeviceType: MaintenanceCountDto[];
  byStatus: MaintenanceCountDto[];
  byTechnician: MaintenanceCountDto[];
  monthly: MaintenanceMonthDto[];
  requestsThisMonth: number;
  tasksByUser: MaintenanceCountDto[];
  tasksThisMonth: number;
  totalRequests: number;
  totalTasks: number;
}

export interface MaintenanceTaskResponseDto {
  canAssign: boolean;
  canDelete: boolean;
  canEdit: boolean;
  completedAt: string | null;
  completedWorks: string;
  createdAt: string;
  departmentId: number | null;
  departmentName: string;
  id: number;
  requestingParty: string;
  requiredWork: string;
  startedAt: string | null;
  taskLocation: string;
  updatedAt: string;
  userId: number;
  userName: string;
}

export interface MaintenanceTaskResponseDtoPagedResultDto {
  items: MaintenanceTaskResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface MaintenanceTransferDto {
  clientName: string;
  createdAt: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  id: number;
  maintenanceRequestId: number;
  newUserName: string | null;
  reason: string;
  requestedById: number;
  requestedByName: string;
  requestNumber: string;
  status: number;
  statusAr: string;
  suggestedUserId: number | null;
  suggestedUserName: string | null;
}

export interface MapBranchOptionDto {
  hasMapData: boolean;
  id: number;
  name: string;
}

export interface MapEntryDto {
  branchId: number;
  branchName: string;
  canDelete: boolean;
  canEdit: boolean;
  createdAt: string;
  createdByName: string;
  departmentId: number | null;
  departmentName: string;
  files: MapEntryFileDto[];
  id: number;
  layerColor: string;
  layerId: number;
  layerName: string;
  rowVersion: string;
  siteId: number;
  siteName: string;
  updatedAt: string | null;
  updatedByName: string;
  values: Record<string, unknown>;
}

export interface MapEntryFileDto {
  contentType: string;
  fieldId: number;
  fileName: string;
  id: number;
  kind: string;
  previewable: boolean;
  size: number;
  uploadedAt: string;
  uploadedByName: string;
}

export interface MapEntryRequestDto {
  departmentId: number | null;
  layerId: number;
  rowVersion: string | null;
  siteId: number;
  values: Record<string, unknown>;
}

export interface MapFileKindDto {
  extensions: string[];
  formats: string;
  key: string;
  label: string;
}

export interface MapFileOptionsDto {
  kinds: MapFileKindDto[];
  maxFileMegabytes: number;
  maxFilesPerField: number;
}

export interface MapLayerDefinitionDto {
  allowMultiple: boolean;
  branchId: number;
  branchName: string;
  color: string;
  description: string;
  entriesCount: number;
  fields: MapLayerFieldDto[];
  id: number;
  isActive: boolean;
  name: string;
  rowVersion: string;
  sortOrder: number;
  source: string;
  sourceFilter: Record<string, string[]>;
  sourceTitle: string;
}

export interface MapLayerDto {
  color: string;
  key: string;
  kind: string;
  sites: MapSiteDto[];
  sitesWithoutCoordinates: number;
  title: string;
  unit: string;
}

export interface MapLayerFieldDto {
  fileKinds: string[];
  id: number;
  isHidden: boolean;
  isRequired: boolean;
  label: string;
  maxFileMegabytes: number;
  maxFiles: number;
  options: string[];
  sortOrder: number;
  type: number;
}

export interface MapLayerFieldRequestDto {
  fileKinds: string[];
  id: number | null;
  isRequired: boolean;
  label: string;
  maxFileMegabytes: number;
  maxFiles: number;
  options: string[];
  type: number;
}

export interface MapLayerRequestDto {
  allowMultiple: boolean;
  branchId: number | null;
  color: string;
  description: string;
  fields: MapLayerFieldRequestDto[];
  isActive: boolean;
  name: string;
  rowVersion: string | null;
  source: string | null;
  sourceFilter: Record<string, string[]> | null;
}

export interface MapSiteDto {
  count: number;
  description: string;
  deviceTypesCount: number;
  entriesCount: number;
  governorateCode: string;
  governorateName: string;
  id: number;
  installationsCount: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
}

export interface MapSourceDto {
  filters: MapSourceFilterDto[];
  key: string;
  title: string;
  unit: string;
}

export interface MapSourceFilterDto {
  key: string;
  label: string;
  options: MapSourceOptionDto[];
}

export interface MapSourceOptionDto {
  label: string;
  value: string;
}

export interface MyMaintenanceRequestDto {
  completedAt: string | null;
  createdAt: string;
  damageTypeName: string;
  deliveredAt: string | null;
  deviceCompanyName: string;
  deviceName: string;
  deviceTypeName: string;
  id: number;
  model: string;
  number: string;
  serialNumber: string;
  statusColor: string;
  statusName: string;
  technicianName: string;
}

export interface MyPermissionsDto {
  permissions: string[];
}

export interface NamedRefDto {
  id: number;
  name: string;
}

export interface NearbySiteDto {
  distanceMeters: number;
  id: number;
  name: string;
}

export interface NotificationResponseDto {
  createdAt: string;
  id: number;
  isRead: boolean;
  message: string;
  readAt: string | null;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  title: string;
  type: string;
}

export interface NotificationResponseDtoPagedResultDto {
  items: NotificationResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface OfficeDashboardDto {
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentName: string;
  employeesCount: number;
  employeesWithoutTasks: number;
  employeesWithTasks: number;
  managerNames: string;
  members: OfficeMemberDto[];
  officeId: number;
  officeName: string;
  recentActivity: DashboardActivityDto[];
  taskDistribution: WorkTaskDistributionDto[];
  tasksCount: number;
}

export interface OfficeMemberDto {
  email: string;
  fullName: string;
  joinedAt: string;
  roleName: string;
  taskNames: string[];
  userId: number;
}

export interface OfficeResponseDto {
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentName: string;
  description: string;
  id: number;
  name: string;
}

export interface OfficeSummaryDto {
  employeesCount: number;
  employeesWithTasks: number;
  id: number;
  managerNames: string;
  name: string;
}

export interface OverviewDashboardDto {
  branches: BranchSummaryDto[];
  branchesCount: number;
  departmentsCount: number;
  employeesByRole: DashboardCountItemDto[];
  employeesCount: number;
  employeesWithTasks: number;
  officesCount: number;
  recentActivity: DashboardActivityDto[];
  workTasksCount: number;
}

export interface PermissionResponseDto {
  description: string;
  id: number;
  name: string;
}

export interface ProjectDocumentResponseDto {
  approved: ProjectDocumentVersionResponseDto;
  canDelete: boolean;
  createdAt: string;
  createdByName: string;
  id: number;
  kind: number;
  kindName: string;
  latest: ProjectDocumentVersionResponseDto;
  projectId: number;
  projectName: string;
  projectNumber: string;
  title: string;
  versions: ProjectDocumentVersionResponseDto[] | null;
  versionsCount: number;
}

export interface ProjectDocumentResponseDtoPagedResultDto {
  items: ProjectDocumentResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProjectDocumentVersionResponseDto {
  approvedAt: string | null;
  approvedByName: string | null;
  canApprove: boolean;
  contentType: string;
  fileName: string;
  id: number;
  isApproved: boolean;
  note: string;
  previewable: boolean;
  sha256: string;
  size: number;
  source: string;
  uploadedAt: string;
  uploadedByName: string;
  uploadedByUserId: number;
  versionNumber: number;
}

export interface ProjectMemberCandidateDto {
  departmentName: string | null;
  fullName: string;
  id: number;
}

export interface ProjectMemberResponseDto {
  addedAt: string;
  departmentName: string | null;
  fullName: string;
  title: string;
  userId: number;
}

export interface ProjectRequestDto {
  beneficiary: string | null;
  branchId: number | null;
  departmentId: number | null;
  description: string | null;
  name: string;
  referenceNumber: string | null;
  rowVersion: string | null;
  siteId: number | null;
  stage: number | null;
}

export interface ProjectResponseDto {
  beneficiary: string;
  branchId: number;
  branchName: string;
  canEdit: boolean;
  createdAt: string;
  createdByName: string;
  createdByUserId: number;
  departmentId: number | null;
  departmentName: string | null;
  description: string;
  id: number;
  isFinished: boolean;
  members: ProjectMemberResponseDto[] | null;
  membersCount: number;
  name: string;
  number: string;
  referenceNumber: string | null;
  rowVersion: string;
  siteId: number | null;
  siteName: string | null;
  stage: number;
  stageName: string;
  updatedAt: string;
}

export interface ProjectResponseDtoPagedResultDto {
  items: ProjectResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProjectUploadResponseDto {
  chunkSize: number;
  createdAt: string;
  documentId: number | null;
  error: string;
  fileName: string;
  id: string;
  kind: number;
  projectId: number;
  received: number;
  size: number;
  status: number;
  statusName: string;
  title: string;
  updatedAt: string;
  versionId: number | null;
}

export interface PublicHolidayRequestDto {
  endDate: string | null;
  name: string;
  startDate: string;
}

export interface PublicHolidayResponseDto {
  days: number;
  endDate: string;
  fridays: number;
  id: number;
  name: string;
  startDate: string;
}

export interface ReceiveSparePartDto {
  date: string | null;
  quantity: number;
  source: string;
  unitCost: number;
}

export interface RegisterRequest {
  branchId: number;
  departmentId: number;
  email: string;
  fullName: string;
  officeId: number;
  password: string;
  roleId: number;
}

export interface ReorderScheduleTasksRequestDto {
  taskIds: number[];
}

export interface ReorderToDoItemsRequestDto {
  itemIds: number[];
}

export interface ReportColumnDto {
  header: string;
  key: string;
  print: boolean;
  sum: boolean;
  type: string;
}

export interface ReportDefinitionDto {
  description: string;
  filters: ReportFilterDto[];
  group: string;
  key: string;
  landscape: boolean;
  maxExcelRows: number;
  maxPrintRows: number;
  previewRows: number;
  title: string;
}

export interface ReportFilterDto {
  default: string | null;
  dependsOn: string | null;
  hint: string | null;
  key: string;
  label: string;
  options: ReportOptionDto[];
  required: boolean;
  type: string;
}

export interface ReportInfoDto {
  description: string;
  group: string;
  key: string;
  landscape: boolean;
  title: string;
}

export interface ReportLogDto {
  branchName: string;
  createdAt: string;
  filters: string;
  format: string;
  id: number;
  reportKey: string;
  reportTitle: string;
  rowCount: number;
  userId: number;
  userName: string;
}

export interface ReportLogDtoPagedResultDto {
  items: ReportLogDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ReportOptionDto {
  label: string;
  parent: string | null;
  value: string;
}

export interface ReportPreviewDto {
  filtersText: string;
  table: ReportTableDto;
}

export interface ReportPrintDto {
  branchName: string;
  filtersText: string;
  key: string;
  landscape: boolean;
  printedAt: string;
  printedBy: string;
  table: ReportTableDto;
  title: string;
}

export interface ReportRunRequestDto {
  filters: Record<string, string | null>;
}

export interface ReportTableDto {
  columns: ReportColumnDto[];
  rows: unknown[][];
  total: number;
}

export interface RequestMaintenanceTransferDto {
  reason: string;
  suggestedUserId: number | null;
}

export interface RequestPartsDto {
  canIssue: boolean;
  deviceLifetimeCost: number;
  items: MaintenanceRequestPartDto[];
  total: number;
}

export interface RoleResponseDto {
  id: number;
  name: string;
  permissions: PermissionResponseDto[];
}

export interface SaveMaintenanceRequestDto {
  accessories: string;
  assigneeId: number | null;
  clientName: string;
  clientPhone: string;
  clientUserId: number | null;
  damageTypeId: number;
  description: string;
  deviceMaintenanceId: number;
  maintenanceRequestStatusId: number;
}

export interface SaveMaintenanceTaskDto {
  assigneeId: number | null;
  completedAt: string | null;
  completedWorks: string;
  requestingParty: string;
  requiredWork: string;
  startedAt: string | null;
  taskLocation: string;
}

export interface SaveTaskRecurrenceRequestDto {
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  dueAfterDays: number | null;
  endDate: string | null;
  frequency: number;
  startDate: string;
  targetId: number;
  targetType: string;
  templateId: number;
}

export interface SaveTaskTemplateRequestDto {
  defaultDueDays: number | null;
  description: string;
  items: string[];
  name: string;
  priority: number;
  title: string;
}

export interface ScheduleAffectedTaskDto {
  code: string;
  name: string;
  taskId: number;
}

export interface ScheduleConflictDto {
  predecessorId: number;
  predecessorName: string;
  successorId: number;
  successorName: string;
}

export interface ScheduleDecisionRequestDto {
  approve: boolean;
  note: string | null;
  rowVersion: string | null;
}

export interface ScheduleDelayRequestDto {
  actions: string | null;
  affectedTaskIds: number[];
  discoveredAt: string;
  kind: number;
  reason: string | null;
}

export interface ScheduleDelayResponseDto {
  actions: string;
  affectedTasks: ScheduleAffectedTaskDto[];
  affectsCriticalWork: boolean;
  approvalAuthority: string;
  approvalDate: string | null;
  approvalDocumentTitle: string | null;
  approvalDocumentVersionId: number | null;
  canDecide: boolean;
  canJustify: boolean;
  daysLate: number;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string;
  discoveredAt: string;
  id: number;
  kind: number;
  kindName: string;
  plannedEndAtDiscovery: string;
  projectId: number;
  reason: string;
  recordedAt: string;
  recordedByName: string;
  recordedByUserId: number;
  rowVersion: string;
  scheduleId: number;
  scheduleVersion: number;
  status: number;
  statusName: string;
  suggestedTasks: ScheduleAffectedTaskDto[] | null;
  taskCode: string;
  taskId: number;
  taskName: string;
}

export interface ScheduleDependencyRequestDto {
  predecessorId: number;
  successorId: number;
}

export interface ScheduleDependencyResponseDto {
  hasConflict: boolean;
  id: number;
  predecessorId: number;
  successorId: number;
}

export interface ScheduleDetailResponseDto {
  actualProgress: number;
  approvedAt: string | null;
  approvedByName: string | null;
  baselineProgress: number;
  canApprove: boolean;
  canClassify: boolean;
  canEdit: boolean;
  canUpdateProgress: boolean;
  createdAt: string;
  createdByName: string;
  createdByUserId: number;
  dependencies: ScheduleDependencyResponseDto[];
  id: number;
  note: string;
  overdueCandidates: number;
  plannedProgress: number;
  projectId: number;
  projectName: string;
  projectNumber: string;
  rowVersion: string;
  status: number;
  statusName: string;
  tasks: ScheduleTaskResponseDto[];
  title: string;
  versionNumber: number;
  warnings: string[];
}

export interface ScheduleDraftRequestDto {
  note: string | null;
  title: string | null;
}

export interface ScheduleExtensionDocumentDto {
  documentTitle: string;
  fileName: string;
  isApproved: boolean;
  versionId: number;
  versionNumber: number;
}

export interface ScheduleExtensionItemResponseDto {
  days: number;
  movesStart: boolean;
  newEnd: string;
  newStart: string;
  oldEnd: string;
  oldStart: string;
  taskCode: string;
  taskId: number;
  taskName: string;
}

export interface ScheduleExtensionPreviewResponseDto {
  conflicts: ScheduleConflictDto[];
  items: ScheduleExtensionItemResponseDto[];
  suggestedTasks: ScheduleAffectedTaskDto[];
}

export interface ScheduleExtensionRequestDto {
  dayCount: number;
  delayId: number | null;
  documentVersionIds: number[];
  lines: ExtensionLineRequestDto[];
  mode: number;
  reason: string | null;
  rowVersion: string | null;
}

export interface ScheduleExtensionResponseDto {
  canDecide: boolean;
  canEdit: boolean;
  conflicts: ScheduleConflictDto[];
  dayCount: number;
  dayCountName: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string;
  delayId: number | null;
  documents: ScheduleExtensionDocumentDto[];
  id: number;
  items: ScheduleExtensionItemResponseDto[];
  mode: number;
  modeName: string;
  projectId: number;
  reason: string;
  requestedAt: string;
  requestedByName: string;
  requestedByUserId: number;
  rowVersion: string;
  scheduleId: number;
  staleProblem: string | null;
  status: number;
  statusName: string;
  suggestedTasks: ScheduleAffectedTaskDto[];
}

export interface ScheduleOverviewResponseDto {
  actualProgress: number | null;
  approvedScheduleId: number | null;
  baselineProgress: number | null;
  canEditSchedule: boolean;
  canEditStartOrder: boolean;
  draftScheduleId: number | null;
  overdueCandidates: number;
  plannedProgress: number | null;
  projectFinished: boolean;
  projectId: number;
  projectName: string;
  projectNumber: string;
  startOrder: StartOrderResponseDto;
  versions: ScheduleVersionResponseDto[];
}

export interface ScheduleProgressEntryResponseDto {
  createdAt: string;
  id: number;
  note: string;
  progress: number;
  status: number;
  statusName: string;
  userName: string;
}

export interface ScheduleTaskRequestDto {
  assigneeUserId: number | null;
  code: string | null;
  name: string;
  note: string | null;
  plannedEnd: string;
  plannedStart: string;
  rowVersion: string | null;
  weight: number;
}

export interface ScheduleTaskResponseDto {
  actualEnd: string | null;
  actualStart: string | null;
  assigneeName: string | null;
  assigneeUserId: number | null;
  code: string;
  datesLocked: boolean;
  extraDays: number;
  id: number;
  isCritical: boolean;
  isOverdueCandidate: boolean;
  name: string;
  note: string;
  originalEnd: string | null;
  originalStart: string | null;
  plannedEnd: string;
  plannedStart: string;
  progress: number;
  rowVersion: string;
  sortOrder: number;
  status: number;
  statusName: string;
  weight: number;
}

export interface ScheduleVersionResponseDto {
  actualProgress: number;
  approvedAt: string | null;
  approvedByName: string | null;
  createdAt: string;
  createdByName: string;
  id: number;
  note: string;
  status: number;
  statusName: string;
  taskCount: number;
  title: string;
  versionNumber: number;
}

export interface SetRecurrenceActiveRequestDto {
  isActive: boolean;
}

export interface SetToDoFlagRequestDto {
  value: boolean;
}

export interface SignatureRequestDto {
  image: string | null;
  password: string;
}

export interface SiteEntriesDto {
  canCreate: boolean;
  entries: MapEntryDto[];
  layers: MapLayerDefinitionDto[];
}

export interface SiteRequestDto {
  contactName: string;
  contactPhone: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  responsibleParty: string;
  rowVersion: string | null;
}

export interface SiteResponseDto {
  activeInstallationsCount: number;
  contactName: string;
  contactPhone: string;
  description: string;
  governorateCode: string;
  governorateName: string;
  id: number;
  installationsCount: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  responsibleParty: string;
  rowVersion: string;
}

export interface SparePartMovementDto {
  balanceAfter: number;
  createdAt: string;
  date: string;
  id: number;
  maintenanceRequestId: number | null;
  note: string;
  quantity: number;
  requestNumber: string | null;
  type: number;
  typeAr: string;
  unitCost: number;
  userName: string;
}

export interface SparePartMovementDtoPagedResultDto {
  items: SparePartMovementDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SparePartReportDto {
  deviceCosts: DeviceCostDto[];
  from: string;
  issuedCost: number;
  lowStockCount: number;
  mostUsed: SparePartUsageDto[];
  partsCount: number;
  stockValue: number;
  to: string;
}

export interface SparePartRequestDto {
  departmentId: number | null;
  description: string;
  deviceCompanyIds: number[];
  deviceTypeIds: number[];
  minQuantity: number;
  name: string;
  partNumber: string;
  unit: string;
}

export interface SparePartResponseDto {
  averageCost: number;
  createdAt: string;
  departmentId: number;
  departmentName: string;
  description: string;
  deviceCompanies: NamedRefDto[];
  deviceTypes: NamedRefDto[];
  id: number;
  isLow: boolean;
  minQuantity: number;
  name: string;
  partNumber: string;
  quantity: number;
  stockValue: number;
  unit: string;
  updatedAt: string;
}

export interface SparePartResponseDtoPagedResultDto {
  items: SparePartResponseDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SparePartUsageDto {
  cost: number;
  name: string;
  quantity: number;
  sparePartId: number;
  unit: string;
}

export interface StartOrderRequestDto {
  completionDays: number;
  executionDays: number;
  notes: string | null;
  orderDate: string;
  orderNumber: string;
  rowVersion: string | null;
  sectorSupervisorUserId: number | null;
  siteEngineerUserId: number | null;
  startDate: string;
  studyCost: number | null;
}

export interface StartOrderResponseDto {
  completionDays: number;
  createdAt: string;
  createdByName: string;
  executionDays: number;
  id: number;
  notes: string;
  orderDate: string;
  orderNumber: string;
  projectId: number;
  rowVersion: string;
  sectorSupervisorName: string | null;
  sectorSupervisorUserId: number | null;
  siteEngineerName: string | null;
  siteEngineerUserId: number | null;
  startDate: string;
  studyCost: number | null;
  updatedAt: string;
}

export interface StartProjectUploadRequestDto {
  documentId: number | null;
  fileName: string;
  kind: number | null;
  note: string | null;
  projectId: number;
  size: number;
  source: string | null;
  title: string | null;
}

export interface TaskBoardDto {
  canCreate: boolean;
  hasScope: boolean;
  mode: string;
  targetTypeLabel: string;
  targetTypes: TaskTargetTypeDto[];
  tasks: AssignedTaskCardDto[];
}

export interface TaskLinkDto {
  available: boolean;
  canRemove: boolean;
  createdByName: string;
  entityId: number;
  entityType: string;
  entityTypeAr: string;
  id: number;
  label: string;
}

export interface TaskRecurrenceDto {
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  dueAfterDays: number | null;
  endDate: string | null;
  frequency: number;
  id: number;
  isActive: boolean;
  lastError: string | null;
  lastRunAt: string | null;
  lastTaskId: number | null;
  nextRunDate: string | null;
  scheduleAr: string;
  startDate: string;
  targetId: number;
  targetName: string;
  targetType: string;
  targetTypeAr: string;
  taskTitle: string;
  templateId: number;
  templateName: string;
}

export interface TaskStatsDto {
  avgDays: number | null;
  byMonth: TaskStatsMonthDto[];
  byTarget: TaskStatsGroupDto[];
  done: number;
  from: string;
  inReview: number;
  onTimeRate: number | null;
  open: number;
  overdue: number;
  returnedTasks: number;
  to: string;
  total: number;
}

export interface TaskStatsGroupDto {
  avgDays: number | null;
  done: number;
  name: string;
  onTimeRate: number | null;
  open: number;
  overdue: number;
  returned: number;
  targetType: string;
  targetTypeAr: string;
  total: number;
}

export interface TaskStatsMonthDto {
  created: number;
  done: number;
  month: string;
}

export interface TaskTargetOptionDto {
  headNames: string;
  id: number;
  name: string;
}

export interface TaskTargetTypeDto {
  label: string;
  value: string;
}

export interface TaskTemplateDto {
  defaultDueDays: number | null;
  description: string;
  id: number;
  items: string[];
  name: string;
  priority: string;
  priorityAr: string;
  title: string;
}

export interface TeamMemberDto {
  email: string;
  fullName: string;
  roleName: string;
}

export interface TechnicianOptionDto {
  fullName: string;
  id: number;
}

export interface ToDoItemResponseDto {
  color: string;
  doneAt: string | null;
  dueDate: string | null;
  id: number;
  isDone: boolean;
  isImportant: boolean;
  isOverdue: boolean;
  lastCompletedAt: string | null;
  linkedTask: ToDoLinkedTaskDto;
  note: string;
  repeat: string | null;
  repeatAr: string | null;
  sortOrder: number;
  title: string;
  toDoListId: number;
}

export interface ToDoLinkedTaskDto {
  available: boolean;
  id: number;
  isOverdue: boolean;
  status: string;
  statusAr: string;
  title: string;
}

export interface ToDoListRequestDto {
  color: string;
  description: string;
  icon: string;
  name: string;
}

export interface ToDoListResponseDto {
  color: string;
  description: string;
  icon: string;
  id: number;
  isArchived: boolean;
  isPinned: boolean;
  items: ToDoItemResponseDto[];
  itemsDone: number;
  itemsOverdue: number;
  itemsTotal: number;
  name: string;
  nextDueDate: string | null;
  ownerName: string;
  userId: number;
}

export interface ToDoTodayDto {
  items: ToDoTodayItemDto[];
  overdueCount: number;
  todayCount: number;
}

export interface ToDoTodayItemDto {
  color: string;
  doneAt: string | null;
  dueDate: string | null;
  id: number;
  isDone: boolean;
  isImportant: boolean;
  isOverdue: boolean;
  lastCompletedAt: string | null;
  linkedTask: ToDoLinkedTaskDto;
  listColor: string;
  listIcon: string;
  listName: string;
  note: string;
  repeat: string | null;
  repeatAr: string | null;
  sortOrder: number;
  title: string;
  toDoListId: number;
}

export interface UpdateAssignedTaskRequestDto {
  description: string;
  dueDate: string | null;
  priority: number;
  title: string;
}

export interface UpdateChecklistItemRequestDto {
  isDone: boolean | null;
  text: string | null;
}

export interface UpdateScheduleProgressRequestDto {
  actualEnd: string | null;
  actualStart: string | null;
  note: string | null;
  progress: number;
  rowVersion: string | null;
  status: number;
}

export interface UpdateToDoItemRequestDto {
  clearDueDate: boolean;
  color: string | null;
  dueDate: string | null;
  isDone: boolean | null;
  isImportant: boolean | null;
  note: string | null;
  repeat: number | null;
  title: string | null;
}

export interface UpdateVacationTypeRequestDto {
  description: string;
  name: string;
}

export interface UpdateWorkTaskRequestDto {
  branchId: number;
  description: string;
  icon: string;
  isActive: boolean;
  name: string;
  userIds: number[];
}

export interface UserResponseDto {
  branchId: number | null;
  branchName: string;
  createdAt: string;
  departmentId: number | null;
  departmentName: string;
  email: string;
  fullName: string;
  id: number;
  isActive: boolean;
  lockedUntil: string | null;
  officeId: number | null;
  officeName: string;
  personalIdNumber: string | null;
  phoneNumber: string | null;
  roleId: number;
  roleName: string;
}

export interface VacationApprovalContextDto {
  colleaguesOnLeave: VacationContextItemDto[];
  colleaguesOnLeaveCount: number;
  daysSinceLastVacation: number | null;
  departmentActiveUsers: number;
  departmentName: string;
  lastVacation: VacationContextItemDto;
  maxPaidDaysPerMonth: number;
  monthApprovedCount: number;
  monthApprovedDays: number;
  monthlyQuota: VacationMonthQuotaDto[];
  otherPending: VacationContextItemDto[];
  projectedPaidDays: number;
  projectedUnpaidDays: number;
  projectedWorkingDays: number;
  typeIsPaid: boolean;
  upcomingApproved: VacationContextItemDto[];
}

export interface VacationAttachmentDto {
  contentType: string;
  fileName: string;
  id: number;
  size: number;
}

export interface VacationContextItemDto {
  endVac: string;
  id: number;
  startVac: string;
  status: string;
  statusAr: string;
  userName: string;
  vacationTypeName: string;
  vacDayCount: number;
}

export interface VacationDaysPreviewDto {
  calendarDays: number;
  fridays: number;
  holidays: PublicHolidayResponseDto[];
  workingDays: number;
}

export interface VacationMonthQuotaDto {
  month: number;
  paidUsed: number;
  year: number;
}

export interface VacationPrintDto {
  branchName: string;
  branchOpinion: string | null;
  departmentName: string;
  employeeName: string;
  personalIdNumber: string | null;
  phone: string | null;
  requesterSignature: string | null;
  signerName: string | null;
  signerSignature: string | null;
  submittedAt: string;
  submittedHijri: string;
  types: VacationPrintTypeDto[];
  vacation: VacationResponseDto;
}

export interface VacationPrintTypeDto {
  id: number;
  name: string;
  selected: boolean;
}

export interface VacationResponseDto {
  attachments: VacationAttachmentDto[];
  branchManagerAccept: boolean;
  branchName: string;
  calendarDays: number;
  createdAt: string;
  currentStage: string;
  departmentName: string;
  endVac: string;
  finalApprovedAt: string | null;
  finalApprovedByName: string | null;
  firstApprovedAt: string | null;
  firstApprovedByName: string | null;
  id: number;
  isPaid: boolean;
  managerAccept: boolean;
  paidDays: number;
  paymentDecided: boolean;
  paymentStatusAr: string;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  requestNumber: string;
  segments: VacationSegmentDto[];
  startVac: string;
  status: string;
  statusAr: string;
  unpaidDays: number;
  userId: number;
  userName: string;
  vacationTypeId: number;
  vacationTypeName: string;
  vacDayCount: number;
  vacReason: string;
}

export interface VacationSegmentDto {
  days: number;
  endDate: string;
  isPaid: boolean;
  startDate: string;
}

export interface VacationStatsDto {
  approvedDaysThisMonth: number;
  onLeave: DashboardVacationRowDto[];
  onLeaveToday: number;
  pendingApprovals: DashboardVacationRowDto[];
  pendingRequests: number;
  pendingStageLabel: string;
  recentActions: DashboardActionDto[];
  scopeName: string;
  scopeType: string;
  upcomingLeavesCount: number;
  vacationsByType: DashboardCountItemDto[];
}

export interface VacationTypeResponseDto {
  description: string;
  id: number;
  isPaid: boolean;
  name: string;
  paymentTypeAr: string;
}

export interface WorkTaskAssigneeDto {
  departmentName: string;
  fullName: string;
  officeName: string;
  userId: number;
}

export interface WorkTaskCardDto {
  assigneesCount: number;
  branchName: string;
  description: string;
  icon: string;
  id: number;
  name: string;
}

export interface WorkTaskDistributionDto {
  assigneeNames: string[];
  icon: string;
  taskId: number;
  taskName: string;
}

export interface WorkTaskResponseDto {
  assignees: WorkTaskAssigneeDto[];
  branchId: number;
  branchName: string;
  createdAt: string;
  description: string;
  icon: string;
  id: number;
  isActive: boolean;
  name: string;
}
