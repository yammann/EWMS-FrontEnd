import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { AppPermission } from '../constants/access';
import {
  MAINTENANCE_LOOKUPS, MaintenanceActivity, MaintenanceClient, MaintenanceTransfer, MyMaintenanceRequest, MaintenanceDevice, MaintenanceDeviceFilter, MaintenanceDeviceInput, MaintenanceLookup, MaintenanceLookupKind, MaintenancePrint, MaintenanceRequest,
  MaintenanceRequestFilter, MaintenanceRequestInput, MaintenanceStats, MaintenanceTask, MaintenanceTaskInput,
  PagedResult, TechnicianOption
} from '../models/maintenance.models';

function query(params: object): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '' && value !== 0) q.set(key, String(value));
  }
  return q.size ? '?' + q : '';
}

/**
 * الصيانة: طلبات الصيانة (أجهزة العملاء)، مهام الصيانة (أعمال ميدانية)، والجداول المساعدة.
 * الصلاحية تحدد العملية، والنطاق (سجلاتي / قسمي / فرعي) يحدده الباكاند ويعيده في canEdit / canAssign.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // ─────────── ما يستطيعه المستخدم (الصلاحيات) ───────────
  readonly can = computed(() => {
    const has = this.auth.hasPermission.bind(this.auth);
    this.auth.currentUser(); // يعاد الحساب عند تبديل المستخدم
    return {
      viewRequests: has(AppPermission.ViewMaintenanceRequests),
      createRequest: has(AppPermission.CreateMaintenanceRequest),
      editRequest: has(AppPermission.EditMaintenanceRequest),
      changeStatus: has(AppPermission.ChangeMaintenanceStatus),
      viewStats: has(AppPermission.ViewMaintenanceStats),
      deleteRequest: has(AppPermission.DeleteMaintenanceRequest),
      assignRequest: has(AppPermission.AssignMaintenanceRequest),
      requestTransfer: has(AppPermission.RequestMaintenanceTransfer),
      viewMine: has(AppPermission.ViewMyMaintenanceRequests),
      viewTasks: has(AppPermission.ViewMaintenanceTasks),
      createTask: has(AppPermission.CreateMaintenanceTask),
      editTask: has(AppPermission.EditMaintenanceTask),
      deleteTask: has(AppPermission.DeleteMaintenanceTask),
      assignTask: has(AppPermission.AssignMaintenanceTask),
      viewDevices: has(AppPermission.ViewMaintenanceDevices),
      createDevice: has(AppPermission.CreateMaintenanceDevice),
      editDevice: has(AppPermission.EditMaintenanceDevice),
      deleteDevice: has(AppPermission.DeleteMaintenanceDevice),
      createLookup: has(AppPermission.CreateMaintenanceLookup),
      editLookup: has(AppPermission.EditMaintenanceLookup),
      deleteLookup: has(AppPermission.DeleteMaintenanceLookup)
    };
  });

  // ─────────── الطلبات ───────────
  requests(filter: MaintenanceRequestFilter) {
    return this.api.get<PagedResult<MaintenanceRequest>>('/MaintenanceRequests/GetAll' + query(filter));
  }
  request(id: number) { return this.api.get<MaintenanceRequest>(`/MaintenanceRequests/Get/${id}`); }
  createRequest(body: MaintenanceRequestInput) { return this.api.post<MaintenanceRequest>('/MaintenanceRequests/Create', body); }
  updateRequest(id: number, body: MaintenanceRequestInput) { return this.api.put<MaintenanceRequest>(`/MaintenanceRequests/Update/${id}`, body); }
  deleteRequest(id: number) { return this.api.delete<{ message: string }>(`/MaintenanceRequests/Delete/${id}`); }
  changeStatus(id: number, statusId: number) { return this.api.put<MaintenanceRequest>(`/MaintenanceRequests/Status/${id}`, { statusId }); }
  assignRequest(id: number, userId: number) { return this.api.put<MaintenanceRequest>(`/MaintenanceRequests/Assign/${id}`, { userId }); }
  activities(id: number) { return this.api.get<MaintenanceActivity[]>(`/MaintenanceRequests/Activities/${id}`); }
  printData(id: number) { return this.api.get<MaintenancePrint>(`/MaintenanceRequests/Print/${id}`); }
  technicians() { return this.api.get<TechnicianOption[]>('/MaintenanceRequests/Technicians'); }
  stats() { return this.api.get<MaintenanceStats>('/MaintenanceRequests/Stats'); }

  /** الموظفون الذين يمكن نقل طلب/مهمة إليهم (رئيس القسم: موظفو قسمه) */
  assignees(departmentId?: number | null) {
    return this.api.get<TechnicianOption[]>('/MaintenanceRequests/Assignees' + query({ departmentId }));
  }

  // ─────────── العميل ───────────
  /** عميل موظف بمطابقة تامة للاسم الكامل أو الرقم الذاتي — قائمة فارغة = عميل من خارج المؤسسة */
  clientLookup(text: string) { return this.api.get<MaintenanceClient[]>('/MaintenanceRequests/ClientLookup' + query({ query: text })); }
  /** «أجهزتي في الصيانة» */
  myRequests() { return this.api.get<MyMaintenanceRequest[]>('/MaintenanceRequests/Mine'); }

  // ─────────── طلبات التحويل (الفني يطلب، ورئيس القسم يقرّر) ───────────
  requestTransfer(requestId: number, body: { reason: string; suggestedUserId: number | null }) {
    return this.api.post<MaintenanceTransfer>(`/MaintenanceRequests/TransferRequest/${requestId}`, body);
  }
  decideTransfer(transferId: number, body: { approve: boolean; userId: number | null; note: string | null }) {
    return this.api.put<MaintenanceTransfer>(`/MaintenanceRequests/Transfer/${transferId}/Decide`, body);
  }
  /** طلب التحويل المعلّق لطلب (null إن لم يوجد) */
  pendingTransfer(requestId: number) { return this.api.get<MaintenanceTransfer | null>(`/MaintenanceRequests/Transfer/${requestId}`); }
  /** طلبات التحويل المعلّقة التي أستطيع البت فيها */
  pendingTransfers() { return this.api.get<MaintenanceTransfer[]>('/MaintenanceRequests/Transfers/Pending'); }
  /** زملاء قسمي (لاقتراح من يُحوَّل إليه الطلب) */
  transferColleagues() { return this.api.get<TechnicianOption[]>('/MaintenanceRequests/Transfers/Colleagues'); }

  // ─────────── أجهزة الصيانة (MaintenanceDevices) ───────────
  devices(filter: MaintenanceDeviceFilter) {
    return this.api.get<PagedResult<MaintenanceDevice>>('/MaintenanceDevices/GetAll' + query(filter));
  }
  device(id: number) { return this.api.get<MaintenanceDevice>(`/MaintenanceDevices/Get/${id}`); }
  /** مطابقة تامة للرقم التسلسلي — 404 (status) إن لم يُسجَّل الجهاز بعد */
  deviceBySerial(serialNumber: string) {
    return this.api.get<MaintenanceDevice>('/MaintenanceDevices/BySerial' + query({ serialNumber }));
  }
  createDevice(body: MaintenanceDeviceInput) { return this.api.post<MaintenanceDevice>('/MaintenanceDevices/Create', body); }
  updateDevice(id: number, body: MaintenanceDeviceInput) { return this.api.put<MaintenanceDevice>(`/MaintenanceDevices/Update/${id}`, body); }
  deleteDevice(id: number) { return this.api.delete<{ message: string }>(`/MaintenanceDevices/Delete/${id}`); }

  // ─────────── المهام ───────────
  tasks(filter: { userId?: number | null; page?: number; pageSize?: number }) {
    return this.api.get<PagedResult<MaintenanceTask>>('/MaintenanceTasks/GetAll' + query(filter));
  }
  createTask(body: MaintenanceTaskInput) { return this.api.post<MaintenanceTask>('/MaintenanceTasks/Create', body); }
  updateTask(id: number, body: MaintenanceTaskInput) { return this.api.put<MaintenanceTask>(`/MaintenanceTasks/Update/${id}`, body); }
  deleteTask(id: number) { return this.api.delete<{ message: string }>(`/MaintenanceTasks/Delete/${id}`); }
  assignTask(id: number, userId: number) { return this.api.put<MaintenanceTask>(`/MaintenanceTasks/Assign/${id}`, { userId }); }

  // ─────────── الجداول المساعدة ───────────
  lookup<T extends MaintenanceLookup = MaintenanceLookup>(kind: MaintenanceLookupKind) {
    return this.api.get<T[]>(`${MAINTENANCE_LOOKUPS[kind].api}/GetAll`);
  }
  createLookup(kind: MaintenanceLookupKind, body: Partial<MaintenanceLookup>) {
    return this.api.post<MaintenanceLookup>(`${MAINTENANCE_LOOKUPS[kind].api}/Create`, body);
  }
  updateLookup(kind: MaintenanceLookupKind, id: number, body: Partial<MaintenanceLookup>) {
    return this.api.put<MaintenanceLookup>(`${MAINTENANCE_LOOKUPS[kind].api}/Update/${id}`, body);
  }
  deleteLookup(kind: MaintenanceLookupKind, id: number) {
    return this.api.delete<{ message: string }>(`${MAINTENANCE_LOOKUPS[kind].api}/Delete/${id}`);
  }

  // ─────────── توقيعي (يُطبع على ورقة التسليم) ───────────
  mySignature() { return this.api.get<{ image: string | null }>('/Auth/Signature'); }
  /** نسخة توقيع جديدة (أو إيقاف التوقيع إن كانت null) — تحتاج كلمة مرور المستخدم */
  saveSignature(image: string | null, password: string) { return this.api.put<{ message: string }>('/Auth/Signature', { image, password }); }
}
