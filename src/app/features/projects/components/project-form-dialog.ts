import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { Branch, Department } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { orEmpty } from '@core/http/or-empty';
import { DeviceService, type Site } from '@features/devices';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { SelectValue } from '@shared/ui/select-value';
import { PROJECT_STAGES, Project, ProjectInput } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';

/**
 * إنشاء مشروع أو تعديله. الفرع يُختار عند الإنشاء لنظرة المؤسسة فقط (غيرها فرعه) ولا يتغير بعده؛ قسم المعالجة يتغير بالإحالة؛
 * الموقع من السجل المشترك (اختياري فقد لا يُعرف عند بدء الدراسة)؛ والمرحلة عند التعديل فقط، وإعادة فتح مشروع مغلق بتغييرها.
 * القوائم المساعدة (فروع/أقسام/مواقع) فشلها لنقص صلاحية عرضها لا يمنع الحفظ: يقول النموذج ما ينقص.
 */
@Component({
  selector: 'app-project-form-dialog', standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, SelectValue],
  styleUrl: '../../../shared/styles/data-tools.scss',
  templateUrl: './project-form-dialog.html',
  styles: [`
    .static-value { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--fill); font-weight: 700; }
    .hint-line { margin: -6px 0 0; font-size: 12px; color: var(--ink-500); }
  `]
})
export class ProjectFormDialog implements OnInit {
  private lookups = inject(LookupsService);
  private devices = inject(DeviceService);
  private service = inject(ProjectsService);

  /** null = مشروع جديد */
  project = input<Project | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<ProjectInput>();
  closed = output<void>();

  access = this.service.access;
  stages = PROJECT_STAGES;
  branches = signal<Branch[]>([]);
  departments = signal<Department[]>([]);
  sites = signal<Site[]>([]);
  missing = signal<string[]>([]);

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    referenceNumber: ['', Validators.maxLength(50)],
    beneficiary: ['', Validators.maxLength(200)],
    description: ['', Validators.maxLength(4000)],
    branchId: [0],
    departmentId: [0],
    siteId: [0],
    stage: [1]
  });

  private branchId = toSignal(this.form.controls.branchId.valueChanges, { initialValue: 0 });

  /** أقسام فرع المشروع (القائمة نفسها محصورة بفرع المستخدم لغير نظرة المؤسسة) */
  departmentOptions = computed(() => {
    const branch = this.project()?.branchId ?? (this.branchId() || null);
    return branch ? this.departments().filter(d => d.branchId === branch) : this.departments();
  });

  ngOnInit() {
    const p = this.project();
    this.form.reset({
      name: p?.name ?? '', referenceNumber: p?.referenceNumber ?? '', beneficiary: p?.beneficiary ?? '', description: p?.description ?? '',
      branchId: p?.branchId ?? 0, departmentId: p?.departmentId ?? 0, siteId: p?.siteId ?? 0, stage: p?.stage ?? 1
    });

    const missing: string[] = [];
    const add = (what: string) => () => missing.push(what);
    forkJoin({
      branches: this.access().canChooseBranch && !p ? this.lookups.branchOptions().pipe(orEmpty<Branch>(add('الفروع'))) : of([] as Branch[]),
      departments: this.access().canListDepartments ? this.lookups.departments().pipe(orEmpty<Department>(add('الأقسام'))) : of([] as Department[]),
      sites: this.devices.sites().pipe(orEmpty<Site>(add('المواقع')))
    }).subscribe(r => {
      this.branches.set(r.branches);
      this.departments.set(r.departments);
      this.sites.set(r.sites);
      if (!this.access().canListDepartments) missing.push('الأقسام');
      this.missing.set(missing);
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const p = this.project();
    this.submitted.emit({
      name: v.name.trim(), referenceNumber: v.referenceNumber.trim() || null, beneficiary: v.beneficiary.trim(), description: v.description.trim(),
      branchId: !p && v.branchId ? v.branchId : null,
      departmentId: v.departmentId || null,
      siteId: v.siteId || null,
      ...(p ? { stage: v.stage, rowVersion: p.rowVersion } : {})
    });
  }
}
