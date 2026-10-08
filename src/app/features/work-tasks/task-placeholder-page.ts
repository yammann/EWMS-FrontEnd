import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WorkTaskService } from '@core/services/work-task.service';
import { WorkTaskCard } from '@core/models/work-task.models';

/**
 * صفحة مهمة العمل. صفحات المهام الفعلية (مثل المخزن: إدخال/إخراج/تقارير) ستُبنى لاحقاً
 * كل مهمة على حدة — عندها تُضاف لها route خاص بها بدلاً من هذه الصفحة.
 */
@Component({
  selector: 'app-task-placeholder', standalone: true, imports: [RouterLink],
  styleUrl: '../shared/organization.scss',
  template: `
    <div class="page">
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
        <a class="btn btn-ghost" routerLink="/">العودة للوحة المتابعة</a>
      } @else if (task(); as t) {
        <header class="page-header">
          <div><span class="eyebrow">مهمة عمل · {{ t.branchName }}</span><h1><span aria-hidden="true">{{ t.icon }}</span> {{ t.name }}</h1>
            @if (t.description) { <p class="muted">{{ t.description }}</p> }</div>
          <a class="btn btn-ghost" routerLink="/">العودة للوحة المتابعة</a>
        </header>
        <section class="panel wip">
          <span class="wip-icon" aria-hidden="true">🚧</span>
          <h2>جاري العمل عليها</h2>
          <p class="muted">صفحة هذه المهمة قيد التطوير وستكون متاحة قريباً.</p>
        </section>
      } @else {
        <div class="panel empty-state" role="status">جارٍ التحميل…</div>
      }
    </div>`,
  styles: [`
    .wip { display: grid; justify-items: center; gap: 10px; padding: 56px 24px; text-align: center; }
    .wip-icon { font-size: 54px; line-height: 1; }
    .wip h2 { font-size: 24px; }
  `]
})
export class TaskPlaceholderPage {
  private service = inject(WorkTaskService);
  task = signal<WorkTaskCard | null>(null);
  error = signal('');

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.task.set(null); this.error.set('');
      this.service.view(Number(p.get('id'))).subscribe({
        next: t => this.task.set(t),
        error: e => this.error.set(e.message)
      });
    });
  }
}
