import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VacationService } from '../../core/services/vacation.service';
import { Vacation } from '../../core/models/vacation.models';

@Component({
  selector: 'app-vacation-review', standalone: true, imports: [CommonModule, ReactiveFormsModule],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">سير الموافقات</span><h1>مراجعة الإجازات</h1><p class="muted">الطلبات التي تنتظر موافقتك حسب دورك وقسمك أو فرعك</p></div><button class="btn btn-ghost" (click)="refresh()" [disabled]="loading() || saving() || teamLoading()">تحديث</button></header>
      <div class="actions tabs" role="tablist">
        <button class="btn" role="tab" [class.btn-ghost]="tab() !== 'pending'" [attr.aria-selected]="tab() === 'pending'" (click)="tab.set('pending')">بانتظار قراري ({{ items().length }})</button>
        <button class="btn" role="tab" [class.btn-ghost]="tab() !== 'team'" [attr.aria-selected]="tab() === 'team'" (click)="showTeam()">كل إجازات فريقي</button>
      </div>
      @if (tab() === 'team') {
        <section class="panel">
          <div class="panel-heading"><div><h2>سجل إجازات فريقي</h2><p>حسب دورك: رئيس القسم يرى قسمه، ورئيس الفرع يرى فرعه — بكل الحالات.</p></div>
            <select [value]="statusFilter()" (change)="statusFilter.set($any($event.target).value)" aria-label="تصفية حسب الحالة">
              <option value="">كل الحالات</option><option value="Pending">قيد الانتظار</option><option value="Approved">معتمدة</option><option value="Rejected">مرفوضة</option><option value="Cancelled">ملغاة</option>
            </select></div>
          @if (teamError()) { <p class="alert alert-error" role="alert">{{ teamError() }}</p> }
          @if (teamLoading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
          @else if (!filteredTeam().length && !teamError()) { <p class="empty-state">لا توجد إجازات مطابقة.</p> }
          @else { <div class="table-wrap"><table><thead><tr><th>الموظف</th><th>القسم</th><th>النوع</th><th>الفترة</th><th>الأيام</th><th>الحالة</th><th>الدفع</th></tr></thead><tbody>
            @for (v of filteredTeam(); track v.id) { <tr><td>{{ v.userName }}</td><td>{{ v.departmentName }}</td><td>{{ v.vacationTypeName }}</td><td>{{ v.startVac | date:'yyyy/MM/dd' }} — {{ v.endVac | date:'yyyy/MM/dd' }}</td><td>{{ v.vacDayCount }}</td><td><span class="status-badge" [class.status-active]="v.status === 'Approved'" [class.status-pending]="v.status.startsWith('Pending')">{{ v.statusAr }}</span>@if (v.rejectionReason) { <small class="form-error block">{{ v.rejectionReason }}</small> }</td><td>{{ v.paymentStatusAr }}</td></tr> }
          </tbody></table></div> }
        </section>
      } @else {
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
      @if (success()) { <p class="alert alert-success" role="status">{{ success() }}</p> }
      @if (loading()) { <div class="panel empty-state" role="status">جارٍ تحميل الطلبات…</div> }
      @else if (!error() && !items().length) { <div class="panel empty-state"><h2>لا توجد طلبات بانتظارك</h2><p>ستظهر طلبات الموظفين هنا عندما تصل إلى مرحلة موافقتك.</p></div> }
      @else { <section class="review-list">
        @for (v of items(); track v.id) {
          <article class="panel review-item">
            <div class="panel-heading"><div><h2>{{ v.userName }}</h2><p>{{ v.branchName }} / {{ v.departmentName }}</p></div><span class="status-badge status-pending">{{ v.statusAr }}</span></div>
            <h3>{{ v.vacationTypeName }} · {{ v.vacDayCount }} أيام · {{ v.paymentStatusAr }}</h3>
            <p>{{ v.startVac | date:'yyyy/MM/dd' }} — {{ v.endVac | date:'yyyy/MM/dd' }}</p><p class="wrap">{{ v.vacReason || 'لم يُذكر سبب' }}</p>
            @if (selected()?.id === v.id) {
              <form [formGroup]="form" (ngSubmit)="submit()" class="form-stack">
                <p>{{ approving() ? 'تأكيد الموافقة على الطلب في مرحلته الحالية؟' : 'تأكيد رفض طلب الإجازة؟' }}</p>
                @if (!approving()) { <label class="form-field">سبب الرفض<textarea formControlName="reason" maxlength="500" rows="2"></textarea></label> }
                <div class="actions"><button class="btn" type="submit" [disabled]="saving() || form.invalid">{{ saving() ? 'جارٍ الحفظ…' : 'تأكيد القرار' }}</button><button class="btn btn-ghost" type="button" [disabled]="saving()" (click)="selected.set(null)">تراجع</button></div>
              </form>
            } @else {
              <div class="actions"><button class="btn" [disabled]="saving()" (click)="choose(v, true)">موافقة</button><button class="btn btn-danger" [disabled]="saving()" (click)="choose(v, false)">رفض</button></div>
            }
          </article>
        }
      </section> }
      }
    </div>`
})
export class VacationReviewPage {
  private service = inject(VacationService);
  items = signal<Vacation[]>([]);
  loading = signal(false); saving = signal(false);
  error = signal(''); success = signal('');
  selected = signal<Vacation | null>(null); approving = signal(true);
  form = inject(FormBuilder).nonNullable.group({ reason: ['', Validators.maxLength(500)] });
  tab = signal<'pending' | 'team'>('pending');
  team = signal<Vacation[]>([]); teamLoaded = false;
  teamLoading = signal(false); teamError = signal('');
  statusFilter = signal('');
  filteredTeam = computed(() => {
    const f = this.statusFilter();
    return f ? this.team().filter(v => v.status.startsWith(f)) : this.team();
  });
  constructor() { this.load(); }
  refresh() { this.load(); if (this.teamLoaded) this.loadTeam(); }
  showTeam() { this.tab.set('team'); if (!this.teamLoaded) this.loadTeam(); }
  loadTeam() {
    this.teamLoading.set(true); this.teamError.set('');
    this.service.all().subscribe({
      next: v => { this.team.set(v); this.teamLoaded = true; this.teamLoading.set(false); },
      error: e => { this.teamError.set(e.message); this.teamLoading.set(false); }
    });
  }
  load() {
    this.loading.set(true); this.error.set('');
    this.service.pending().subscribe({
      next: v => { this.items.set(v); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
  choose(v: Vacation, approve: boolean) { this.selected.set(v); this.approving.set(approve); this.form.reset(); this.error.set(''); this.success.set(''); }
  submit() {
    const v = this.selected();
    if (!v || this.saving() || this.form.invalid) return;
    this.saving.set(true); this.error.set('');
    this.service.approve(v.id, this.approving(), this.form.getRawValue().reason).subscribe({
      next: result => { this.saving.set(false); this.selected.set(null); this.success.set(result.message); this.load(); if (this.teamLoaded) this.loadTeam(); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
