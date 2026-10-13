import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ApiService } from '@core/services/api.service';
import { User } from '@core/models/ewms.models';
import { AppPermission, MY_VACATIONS_ACCESS } from '@core/constants/access';
import { formatPhone } from '@core/utils/phone';
import { utcDate } from '@core/utils/format';
import { Icon } from '@shared/ui/icon';
import { SignaturePanel } from '../components/signature-panel';
import { PasswordDialog } from '../components/password-dialog';

/**
 * الملف الشخصي: البيانات الوظيفية والتوقيع الإلكتروني فقط (قرار المستخدم 2026-10-13).
 * طلبات الإجازة وسجلها وأرقامها انتقلت إلى «إجازاتي» (/vacations/my) في قسم الإجازات.
 * «تغيير كلمة المرور» لكل مستخدم مسجّل (Auth/Password، 2026-10-13).
 */
@Component({
  selector: 'app-profile-page', standalone: true,
  imports: [Icon, CommonModule, RouterLink, SignaturePanel, PasswordDialog],
  templateUrl: './profile-page.html', styleUrl: '../../../shared/styles/page-base.scss'
})
export class ProfilePage {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  user = this.auth.currentUser;
  profile = signal<User | null>(null);
  profileError = signal('');
  passwordOpen = signal(false);
  /** توقيعي الإلكتروني (يُحفظ مع قراراتي الموقَّعة ويُطبع على الأوراق): لمن يملك ManageMySignature */
  canSign = computed(() => this.auth.hasPermission(AppPermission.ManageMySignature));
  canVacations = computed(() => this.auth.hasAnyPermission(MY_VACATIONS_ACCESS));
  phone = formatPhone;
  utc = utcDate;

  constructor() { this.loadProfile(); }

  loadProfile() {
    this.profileError.set('');
    this.api.get<User>('/Auth/Me').subscribe({
      next: value => this.profile.set(value),
      error: e => this.profileError.set(e.message)
    });
  }
}
