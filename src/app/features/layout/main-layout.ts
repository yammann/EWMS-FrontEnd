import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationToasts } from './notification-toasts';
import { LEADER_ROLES, roleLabel } from '../../core/utils/roles';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationToasts],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout {
  private auth = inject(AuthService);
  private notifications = inject(NotificationService);
  user = this.auth.currentUser;
  unreadCount = this.notifications.unreadCount;
  roleLabel = roleLabel;
  /** للنافبار: الاسم الأول والحرف الأول للصورة الرمزية */
  private displayName = computed(() => (this.user()?.fullName || this.user()?.email || '').trim());
  firstName = computed(() => this.displayName().split(/\s+/)[0] ?? '');
  initial = computed(() => this.displayName().charAt(0).toUpperCase() || '؟');

  constructor() {
    // اتصال لحظي (SignalR) لاستقبال الإشعارات فور حدوثها
    this.notifications.start(() => this.auth.getToken() ?? '');
  }

  /* =====================================================
   * الصلاحيات — تُستخدم في السايدبار
   * ===================================================== */
  canManageOffices = computed(() => this.auth.hasPermission('ManageOffices'));
  canReviewVacations = computed(() => this.auth.canReviewVacations());
  canViewVacationStats = computed(() => LEADER_ROLES.includes(this.user()?.role ?? ''));
  canManageVacationTypes = computed(() => this.auth.hasPermission('ManageVacationTypes'));
  canManageDepartments = computed(() => this.auth.hasPermission('ManageDepartments'));
  canManageBranches = computed(() => this.auth.hasPermission('ManageBranches'));
  canManageUsers = computed(() => this.auth.hasPermission('ManageUsers'));
  canManageRoles = computed(() => this.auth.hasPermission('ManageRoles'));
  canManageWorkTasks = computed(() => this.auth.hasPermission('ManageWorkTasks'));

  logout() {
    this.auth.logout();
  }
}
