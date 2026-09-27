import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-organization-home', standalone: true, imports: [RouterLink],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      <header class="page-header"><div><span class="eyebrow">نظام إدارة سير العمل</span><h1>مرحباً، {{ auth.currentUser()?.fullName }}</h1><p class="muted">انتقل إلى خدماتك ومهامك المتاحة</p></div></header>
      <section class="cards">
        <a class="link-card" routerLink="/profile"><span class="eyebrow">خدمات الموظف</span><h2>ملفي وإجازاتي</h2><p class="muted">بياناتك الوظيفية وتقديم الإجازات ومتابعة حالتها</p><span>فتح الملف ←</span></a>
        @if (auth.canReviewVacations()) { <a class="link-card" routerLink="/vacations/review"><span class="eyebrow">مهام الموافقة</span><h2>مراجعة الإجازات</h2><p class="muted">الطلبات التي تنتظر قرارك في المرحلة الحالية</p><span>عرض الطلبات ←</span></a> }
        @for (item of links; track item.path) {
          @if (auth.hasPermission(item.permission)) { <a class="link-card" [routerLink]="item.path"><span class="eyebrow">الإدارة</span><h2>{{ item.label }}</h2><p class="muted">{{ item.description }}</p><span>فتح الصفحة ←</span></a> }
        }
      </section>
    </div>`
})
export class OrganizationHome {
  auth = inject(AuthService);
  links = [
    { path: '/branches', permission: 'ManageBranches', label: 'الفروع', description: 'إدارة فروع المؤسسة' },
    { path: '/departments', permission: 'ManageDepartments', label: 'الأقسام', description: 'تنظيم الأقسام داخل الفروع' },
    { path: '/offices', permission: 'ManageOffices', label: 'المكاتب', description: 'إدارة المكاتب التابعة للأقسام' },
    { path: '/users', permission: 'ManageUsers', label: 'الموظفون', description: 'إدارة الموظفين وتعيين مكاتبهم وأدوارهم' },
    { path: '/roles', permission: 'ManageRoles', label: 'الأدوار والصلاحيات', description: 'تحديد الخدمات المسموحة لكل دور' },
    { path: '/vacation-types', permission: 'ManageVacationTypes', label: 'أنواع الإجازات', description: 'إدارة أنواع الإجازات المتاحة للموظفين' }
  ];
}
