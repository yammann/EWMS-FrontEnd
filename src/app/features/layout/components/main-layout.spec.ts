import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { MainLayout } from './main-layout';

@Component({ template: '', standalone: true }) class Blank {}

describe('MainLayout — القائمة على الشاشات الصغيرة', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', component: Blank }])]
    });
    TestBed.inject(AuthService).currentUser.set({
      role: 'x', permissions: ['ViewToDoLists', 'ViewHolidays'], fullName: 'تجربة', email: 't@e.test',
      branchId: null, departmentId: null, officeId: null, expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  });

  it('opens with the menu button, closes with Esc and after navigating', async () => {
    const f = TestBed.createComponent(MainLayout);
    const layout = f.componentInstance;
    layout.compact.set(true);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    const toggle = el.querySelector<HTMLButtonElement>('.menu-toggle')!;

    expect(el.querySelector('.shell')!.classList).not.toContain('menu-open');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click(); await f.whenStable();
    expect(el.querySelector('.shell')!.classList).toContain('menu-open');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // عناوين الأقسام تظهر كعناوين (لا أزرار طي) على الشاشة الصغيرة
    expect(el.querySelector('.nav-heading')?.textContent).toContain('الإجازات');
    expect(el.querySelector('.nav-section')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await f.whenStable();
    expect(layout.menuOpen()).toBe(false);

    layout.menuOpen.set(true); await f.whenStable();
    await TestBed.inject(Router).navigateByUrl('/todo-lists'); await f.whenStable();
    expect(layout.menuOpen()).toBe(false);
  });
});
