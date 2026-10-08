import { NgTemplateOutlet } from '@angular/common';
import { BranchMapComponent } from '@features/map';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardService } from '@core/services/dashboard.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { NotificationService } from '@core/services/notification.service';
import { OverviewDashboard } from '@core/models/dashboard.models';
import { ActivityList } from './dashboard-widgets';
import { StatTile } from '@shared/ui/stat-tile';

/** لوحة مدير النظام: إحصائيات عامة للمؤسسة + الدخول لأي فرع (صفحات الإدارة من السايدبار) */
@Component({
  selector: 'app-overview-dashboard', standalone: true,
  imports: [RouterLink, NgTemplateOutlet, StatTile, ActivityList, BranchMapComponent],
  styleUrl: './dashboard.scss',
  template: `
    <div class="page">
      @if (showMap()) {
        <!-- خريطة سوريا مثبّتة في رأس الصفحة (لمن يملك ViewBranchMap) — الصفحة تنزلق فوقها أثناء السكرول -->
        <app-branch-map>
          <header class="page-header"><ng-container *ngTemplateOutlet="headerTpl" /></header>
          <ng-container *ngTemplateOutlet="bodyTpl" />
        </app-branch-map>
      } @else {
        <header class="page-header"><ng-container *ngTemplateOutlet="headerTpl" /></header>
        <ng-container *ngTemplateOutlet="bodyTpl" />
      }
    </div>

    <ng-template #headerTpl>
          <div><span class="eyebrow">مدير النظام</span><h1>نظرة عامة على المؤسسة</h1><p class="header-sub">الهيكل التنظيمي والكادر ومهام العمل في كل الفروع</p></div>
          <div class="header-actions"><button class="btn btn-ghost" (click)="load()" [disabled]="loading()">تحديث</button></div>
    </ng-template>

    <ng-template #bodyTpl>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (data(); as d) {
        <section class="dash-stats" aria-label="إحصائيات المؤسسة">
          <app-stat-tile label="الفروع" [value]="d.branchesCount" icon="🏛️" tone="green" [hint]="d.workTasksCount + ' مهمة عمل فعّالة'" />
          <app-stat-tile label="الأقسام" [value]="d.departmentsCount" icon="🏢" tone="blue" />
          <app-stat-tile label="المكاتب" [value]="d.officesCount" icon="🚪" tone="purple" />
          <app-stat-tile label="الموظفون" [value]="d.employeesCount" icon="👥" tone="orange" [hint]="d.employeesWithTasks + ' منهم مسؤولون عن مهام عمل'" />
        </section>

        <section class="panel">
          <div class="panel-heading"><div><h2>الفروع</h2><p>اضغط على الفرع لعرض لوحته</p></div></div>
          @if (d.branches.length) {
            <div class="table-wrap"><table>
              <thead><tr><th>الفرع</th><th>رئيس الفرع</th><th>الأقسام</th><th>المكاتب</th><th>الموظفون</th><th>مهام العمل</th></tr></thead>
              <tbody>
                @for (b of d.branches; track b.id) {
                  <tr>
                    <td><a class="cell-link" [routerLink]="['/dashboard/branch', b.id]">{{ b.name }}</a></td>
                    <td [class.muted-cell]="!b.managerNames">{{ b.managerNames || 'لم يُعيَّن' }}</td>
                    <td class="num">{{ b.departmentsCount }}</td>
                    <td class="num">{{ b.officesCount }}</td>
                    <td class="num">{{ b.employeesCount }}</td>
                    <td class="num">{{ b.tasksCount }}</td>
                  </tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="empty-state">لا توجد فروع بعد</p> }
        </section>


        <section class="panel">
          <div class="panel-heading"><div><h2>آخر الإجراءات</h2><p>انضمام الموظفين وإضافة مهام العمل وإسنادها</p></div></div>
          <app-activity-list [items]="d.recentActivity" />
        </section>

      } @else if (loading()) {
        <div class="panel skeleton" role="status">جارٍ تحميل النظرة العامة…</div>
      }


    </ng-template>`
})
export class OverviewDashboardPage {
  private service = inject(DashboardService);
  private auth = inject(AuthService);
  showMap = computed(() => this.auth.hasPermission(AppPermission.ViewBranchMap));

  data = signal<OverviewDashboard | null>(null);
  loading = signal(false);
  error = signal('');


  constructor() {
    this.load();
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load() {
    this.loading.set(true); this.error.set('');
    this.service.overview().subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }
}
