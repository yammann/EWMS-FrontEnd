import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Logo } from '../../../shared/ui/logo';
import { Stamp } from '../../../shared/ui/stamp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, Logo, Stamp],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  currentYear = new Date().getFullYear();

  /** طوابع المحافظات منثورة في الخلفية (الهوية البصرية) — الموضع والدوران والتأخير */
  backgroundStamps = [
    { code: 'SY02', x: '6%', y: '8%', r: '-8deg', delay: '0s' },
    { code: 'SY05', x: '80%', y: '10%', r: '7deg', delay: '-2s' },
    { code: 'SY04', x: '12%', y: '62%', r: '6deg', delay: '-4s' },
    { code: 'SY10', x: '84%', y: '66%', r: '-6deg', delay: '-6s' },
    { code: 'SY01', x: '46%', y: '82%', r: '-3deg', delay: '-3s' },
    { code: 'SY09', x: '44%', y: '2%', r: '4deg', delay: '-5s' }
  ];

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login({
      Email: this.form.value.email!,
      Password: this.form.value.password!
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.message ||
          err?.message ||
          'فشل تسجيل الدخول، تحقق من البيانات'
        );
      }
    });
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }
}