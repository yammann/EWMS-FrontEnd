import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaintenanceService } from '../data-access/maintenance.service';
import {
  MaintenanceClient, MaintenanceDevice, MaintenanceLookup, MaintenanceRequest, MaintenanceStatus, TechnicianOption, finalStageConfirm, isFinalStage
} from '../data-access/maintenance.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { isValidPhone, normalizePhone } from '@core/utils/phone';
import { DeviceFormDialog } from './device-form-dialog';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

export interface RequestLookups {
  deviceTypes: MaintenanceLookup[];
  companies: MaintenanceLookup[];
  damageTypes: MaintenanceLookup[];
  statuses: MaintenanceStatus[];
}

/**
 * تسجيل طلب صيانة جديد أو تعديله. الفني = من يسجّل الطلب (يُملأ في الباكاند).
 * الجهاز يُختار من «أجهزة الصيانة» بالرقم التسلسلي (MaintenanceDevices/BySerial)؛ إن لم يكن مسجّلاً يُضاف أولاً
 * (نافذة الجهاز: الرقم يُكتب مرتين بلا لصق) ثم يُقدَّم الطلب بمعرّفه — الطلب لا يحمل بيانات الجهاز بنفسه.
 */
@Component({
  selector: 'app-request-form-dialog', standalone: true, imports: [Alert, ReactiveFormsModule, Modal, DeviceFormDialog],
  styleUrls: ['../../../shared/styles/data-tools.scss', './request-form-dialog.scss'],
  templateUrl: './request-form-dialog.html',
  
})
export class RequestFormDialog implements OnInit {
  private service = inject(MaintenanceService);
  private confirm = inject(ConfirmService);
  can = this.service.can;

  /** null = طلب جديد */
  request = input<MaintenanceRequest | null>(null);
  lookups = input.required<RequestLookups>();
  saved = output<MaintenanceRequest>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');

  /** الجهاز المختار (من البحث بالرقم التسلسلي، أو جهاز الطلب عند التعديل) */
  device = signal<MaintenanceDevice | null>(null);
  serialQuery = signal('');
  searching = signal(false);
  /** الرقم الذي لم يُعثر عليه (يُقترح في نافذة إضافة الجهاز) */
  notFound = signal('');
  lookupError = signal('');
  addOpen = signal(false);
  /** أجهزة مطابقة لما يُكتب في حقل الرقم التسلسلي (أول 6 بالبادئة) */
  suggestions = signal<MaintenanceDevice[]>([]);
  private typing$ = new Subject<string>();
  /** العميل: موظف (بحث تام بالاسم الكامل أو الرقم الذاتي) أو خارجي عند عدم العثور عليه */
  client = signal<MaintenanceClient | null>(null);
  external = signal(false);
  clientQuery = signal('');
  clientSearching = signal(false);
  clientError = signal('');
  matches = signal<MaintenanceClient[]>([]);

  /** موظفو قسمي للإسناد عند الإنشاء (AssignMaintenanceRequest) */
  assignees = signal<TechnicianOption[]>([]);
  canAssignOnCreate = () => !this.request() && this.can().assignRequest;

  form = inject(FormBuilder).nonNullable.group({
    clientName: ['', [Validators.required, Validators.maxLength(200)]],
    clientPhone: ['', (c: AbstractControl<string>) => isValidPhone(c.value) ? null : { phone: true }],
    damageTypeId: [0, Validators.min(1)],
    maintenanceRequestStatusId: [0, Validators.min(1)],
    accessories: ['', Validators.maxLength(500)],
    assigneeId: [0],
    description: ['', Validators.maxLength(2000)]
  });

  isFinal = isFinalStage;
  /** طلب جديد لا يُسجَّل في حالة نهائية (مُسلَّم / غير قابل للصيانة) — الباكاند يرفضه أيضاً */
  statusOptions = () => this.request() ? this.lookups().statuses : this.lookups().statuses.filter(s => !isFinalStage(s.stage));

  constructor() {
    this.typing$.pipe(
      debounceTime(250), distinctUntilChanged(),
      switchMap(q => q.length < 2 ? of([]) : this.service.devices({ serialNumber: q, pageSize: 6 }).pipe(
        switchMap(r => of(r.items)), catchError(() => of([])))),
      takeUntilDestroyed()
    ).subscribe(list => this.suggestions.set(list));
  }

  ngOnInit() {
    const r = this.request();
    const options = this.statusOptions();
    this.form.reset({
      clientName: r?.clientName ?? '', clientPhone: r?.clientPhone ?? '', damageTypeId: r?.damageTypeId ?? 0,
      // طلب جديد: أول حالة في مرحلة «جديد»، وإلا أول حالة غير نهائية
      maintenanceRequestStatusId: r?.maintenanceRequestStatusId ?? (options.find(s => s.stage === 1) ?? options[0])?.id ?? 0,
      accessories: r?.accessories ?? '', description: r?.description ?? ''
    });
    // العميل عند التعديل: موظف مربوط، أو خارجي بالاسم المسجّل؛ وعند الإنشاء يبدأ بالبحث
    if (r?.clientUserId) this.client.set({ id: r.clientUserId, fullName: r.clientName, departmentName: r.clientDepartmentName, phone: r.clientPhone });
    else if (r) this.external.set(true);

    if (this.canAssignOnCreate())
      this.service.assignees().subscribe({ next: list => this.assignees.set(list), error: () => { } });
    if (r) {
      this.device.set({
        id: r.deviceMaintenanceId, name: r.deviceName, serialNumber: r.serialNumber, model: r.model, description: '',
        deviceTypeId: r.deviceTypeId, deviceTypeName: r.deviceTypeName, deviceCompanyId: r.deviceCompanyId, deviceCompanyName: r.deviceCompanyName
      });
    }
    // تعديل طلب: الحالة تُغيَّر بصلاحية تغيير الحالة فقط (الباكاند يرفض غير ذلك)؛ الطلب الجديد يختار حالته
    if (r && !(this.can().changeStatus && r.canChangeStatus)) this.form.controls.maintenanceRequestStatusId.disable();
  }

  missingLookups() {
    const l = this.lookups();
    const missing = [!l.damageTypes.length && 'أنواع الأعطال', !l.statuses.length && 'حالات الطلب'].filter(Boolean);
    return missing.length ? 'لا توجد بيانات في: ' + missing.join('، ') : '';
  }

  findClient() {
    const text = this.clientQuery().trim();
    if (!text || this.clientSearching()) return;
    this.clientSearching.set(true); this.clientError.set(''); this.matches.set([]);
    this.service.clientLookup(text).subscribe({
      next: list => {
        this.clientSearching.set(false);
        if (list.length === 1) this.pickClient(list[0]);
        else if (list.length > 1) this.matches.set(list);
        else {
          // لا موظف مطابق: عميل من خارج المؤسسة — الاسم المكتوب يُقترح (إن لم يكن رقماً ذاتياً)
          this.external.set(true);
          if (!/^[A-Za-z0-9-]+$/.test(text)) this.form.controls.clientName.setValue(text);
        }
      },
      error: e => { this.clientSearching.set(false); this.clientError.set(e.message); }
    });
  }

  pickClient(c: MaintenanceClient) {
    this.client.set(c); this.matches.set([]); this.external.set(false);
    this.form.controls.clientName.setValue(c.fullName);
    if (!this.form.controls.clientPhone.value && c.phone) this.form.controls.clientPhone.setValue(c.phone);
  }

  changeClient() {
    this.clientQuery.set(this.client()?.fullName ?? this.form.controls.clientName.value);
    this.client.set(null); this.external.set(false); this.matches.set([]);
    this.form.controls.clientName.setValue('');
  }

  /** كل حرف يُكتب: يمسح «غير موجود»، ثم بعد توقف قصير تُجلب الأجهزة التي يبدأ رقمها بما كُتب */
  typed(value: string) {
    this.serialQuery.set(value); this.notFound.set('');
    if (value.trim().length < 2) this.suggestions.set([]);
    this.typing$.next(value.trim());
  }

  pickDevice(device: MaintenanceDevice, event: Event) {
    event.preventDefault();                      // قبل blur كي لا تُغلق القائمة قبل النقر
    this.suggestions.set([]); this.notFound.set(''); this.lookupError.set('');
    this.device.set(device);
  }

  closeSuggestions() { setTimeout(() => this.suggestions.set([]), 120); }

  findDevice() {
    const serial = this.serialQuery().trim();
    if (!serial || this.searching()) return;
    this.searching.set(true); this.notFound.set(''); this.lookupError.set('');
    this.service.deviceBySerial(serial).subscribe({
      next: d => { this.searching.set(false); this.device.set(d); },
      error: (e: { status: number; message: string }) => {
        this.searching.set(false);
        if (e.status === 404) this.notFound.set(serial);
        else this.lookupError.set(e.message);
      }
    });
  }

  deviceAdded(d: MaintenanceDevice) {
    this.addOpen.set(false); this.notFound.set(''); this.serialQuery.set('');
    this.device.set(d);
  }

  changeDevice() {
    this.serialQuery.set(this.device()?.serialNumber ?? '');
    this.device.set(null);
  }

  /** يمنع كتابة غير الأرقام و + والفراغ والشرطة في حقل الهاتف */
  cleanPhone() {
    const control = this.form.controls.clientPhone;
    const cleaned = control.value.replace(/[^\d+\s-]/g, '').replace(/(?!^)\+/g, '');
    if (cleaned !== control.value) control.setValue(cleaned);
  }

  async save() {
    const device = this.device();
    if (this.form.invalid || !device || this.saving()) return;
    const v = this.form.getRawValue();
    const r = this.request();
    // التحويل إلى حالة نهائية يُقفل الطلب — يحتاج تأكيداً صريحاً
    const target = this.lookups().statuses.find(s => s.id === v.maintenanceRequestStatusId);
    if (r && target && v.maintenanceRequestStatusId !== r.maintenanceRequestStatusId && isFinalStage(target.stage)
        && !await this.confirm.ask(finalStageConfirm(r.number, target.name), 'نعم، أقفل الطلب', 'حالة نهائية')) return;
    const body = {
      clientUserId: this.client()?.id ?? null,
      clientName: (this.client()?.fullName ?? v.clientName).trim(), clientPhone: normalizePhone(v.clientPhone),
      deviceMaintenanceId: device.id, damageTypeId: v.damageTypeId,
      assigneeId: r ? null : (v.assigneeId || null),
      accessories: v.accessories.trim(), description: v.description.trim(),
      maintenanceRequestStatusId: v.maintenanceRequestStatusId
    };
    trackRequest((r ? this.service.updateRequest(r.id, body) : this.service.createRequest(body)), this.saving, this.error, result => { this.saved.emit(result); });
  }
}
