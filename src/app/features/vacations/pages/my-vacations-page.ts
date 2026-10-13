import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { daysAr } from '@core/utils/arabic-count';
import { localDateInput } from '@core/utils/format';
import { Pagination } from '@core/utils/pagination';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { Icon } from '@shared/ui/icon';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { StatTile } from '@shared/ui/stat-tile';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { VacationAttachments } from '../components/vacation-attachments';
import { VacationRequestDialog } from '../components/vacation-request-dialog';
import { VacationService } from '../data-access/vacation.service';
import { VACATION_PAID_DAYS_PER_MONTH, Vacation } from '../data-access/vacation.models';

const day = (iso: string) => iso.slice(0, 10);

/**
 * «إجازاتي» (قرار المستخدم 2026-10-13، نُقلت من الملف الشخصي): أرقام إجازات المستخدم نفسه، وسجل طلباته (طباعة، إلغاء،
 * مرفقات)، وزر «تقديم طلب إجازة» يفتح النموذج في نافذة عائمة. السجل بصلاحية ViewVacations والتقديم بـ CreateVacation.
 */
@Component({
  selector: 'app-my-vacations-page', standalone: true,
  imports: [PageHeader, StatTile, Alert, EmptyState, Pager, Icon, DatePipe, RouterLink, VacationAttachments, VacationRequestDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  templateUrl: './my-vacations-page.html',
  styles: [`.period { white-space: nowrap; font-variant-numeric: tabular-nums; }`]
})
export class MyVacationsPage {
  private service = inject(VacationService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private latest = latestRequest();

  canView = computed(() => this.auth.hasPermission(AppPermission.ViewVacations));
  canRequest = computed(() => this.auth.hasPermission(AppPermission.CreateVacation));
  canPrint = computed(() => this.auth.hasPermission(AppPermission.PrintVacation));

  vacations = signal<Vacation[]>([]);
  loading = signal(false);
  error = signal('');
  requestOpen = signal(false);
  cancellingId = signal<number | null>(null);
  pager = new Pagination(() => this.vacations());

  readonly paidPerMonth = VACATION_PAID_DAYS_PER_MONTH;
  private today = localDateInput();
  private approved = computed(() => this.vacations().filter(v => v.status === 'Approved'));

  /** الأيام المدفوعة المعتمدة في الشهر الحالي (من أجزاء الأشهر، مشتركة بين كل الأنواع المدفوعة) */
  paidThisMonth = computed(() => {
    const month = this.today.slice(0, 7);
    return this.approved().flatMap(v => v.segments).filter(s => s.isPaid && s.startDate.slice(0, 7) === month).reduce((n, s) => n + s.days, 0);
  });
  /** أيام العمل المعتمدة في السنة الحالية */
  yearDays = computed(() => {
    const year = this.today.slice(0, 4);
    return this.approved().flatMap(v => v.segments).filter(s => s.startDate.slice(0, 4) === year).reduce((n, s) => n + s.days, 0);
  });
  /** «بقي يومان/يوم واحد» أو «استُنفد» (الحد مشترك بين كل الأنواع المدفوعة) */
  paidHint = computed(() => {
    const left = this.paidPerMonth - this.paidThisMonth();
    return left > 0 ? `بقي ${daysAr(left)} — لكل الأنواع المدفوعة` : 'استُنفد المدفوع لهذا الشهر';
  });
  pending = computed(() => this.vacations().filter(v => v.status.startsWith('Pending')).length);
  /** الإجازة الجارية الآن، وإلا أقرب إجازة قادمة (معتمدة أو بانتظار الموافقة) */
  current = computed(() => this.approved().find(v => day(v.startVac) <= this.today && day(v.endVac) >= this.today) ?? null);
  next = computed(() => this.vacations()
    .filter(v => (v.status === 'Approved' || v.status.startsWith('Pending')) && day(v.startVac) > this.today)
    .sort((a, b) => a.startVac.localeCompare(b.startVac))[0] ?? null);

  constructor() { if (this.canView()) this.load(); }

  load() { this.latest(this.service.mine(), this.loading, this.error, value => this.vacations.set(value)); }

  formatDay(iso: string) { return day(iso).replaceAll('-', '/'); }
  days(n: number) { return daysAr(n); }
  canCancel(v: Vacation) { return v.status === 'PendingManager' || v.status === 'PendingBranchManager'; }

  submitted(v: Vacation | undefined) {
    this.requestOpen.set(false);
    this.toast.success(v
      ? `تم تقديم طلب الإجازة رقم ${v.requestNumber} (أيام العمل: ${daysAr(v.vacDayCount)}). الحالة: ${v.statusAr}`
      : 'تم تقديم طلب الإجازة');
    if (this.canView()) { this.pager.go(1); this.load(); }
  }

  async cancel(v: Vacation) {
    const ok = await this.confirm.ask(
      `إلغاء طلب ${v.vacationTypeName} (${this.formatDay(v.startVac)} — ${this.formatDay(v.endVac)})؟ يبقى الطلب في السجل بحالة «ملغاة».`, 'إلغاء الطلب');
    if (!ok) return;
    this.cancellingId.set(v.id);
    this.service.cancel(v.id).subscribe({
      next: r => { this.cancellingId.set(null); this.toast.success(r.message); this.load(); },
      error: e => { this.cancellingId.set(null); this.toast.error(e.message); }
    });
  }
}
