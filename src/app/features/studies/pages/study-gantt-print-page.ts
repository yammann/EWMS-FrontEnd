import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PRINT_HEADER } from '@core/constants/print';
import { BackButton } from '@shared/ui/back-button';
import { Icon } from '@shared/ui/icon';
import { Logo } from '@shared/ui/logo';
import { StudyGantt } from '../components/study-gantt';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { StageTask, StudyProject } from '../data-access/studies.models';

/** ارتفاع الجزء المتاح للمخطط في ورقة A4 أفقية (بالبكسل) بعد الترويسة والمفتاح */
const AVAILABLE_H = 540;
/** عرض الورقة الأفقية بلا هوامش ≈ 281mm؛ ما يتبقى للمحور بعد عمود الأسماء */
const AXIS_W = 840;

/**
 * طباعة المخطط الزمني للمشروع على A4 أفقي بألوان ثابتة (ورق أبيض بصرف النظر عن مظهر التطبيق):
 * ترويسة (الدولة، الفرع، المشروع، تاريخ الطباعة)، ثم المخطط بعرض اليوم المحسوب ليتسع الورقة، ثم مفتاح الحالات.
 * افتراضياً المراحل وحدها (تتسع صفحة واحدة)، و«مع المهام» يُصغِّر المخطط ليبقى في صفحة ما أمكن (لا أقل من 55%).
 * صفحة خارج الإطار العام؛ الخادم يفحص عرض المشاريع وحدّ الفرع.
 */
@Component({
  selector: 'app-study-gantt-print', standalone: true, imports: [Icon, BackButton, DatePipe, Logo, StudyGantt],
  templateUrl: './study-gantt-print-page.html',
  styleUrl: './study-gantt-print-page.scss'
})
export class StudyGanttPrintPage {
  private service = inject(StudyProjectsService);
  private content = viewChild<ElementRef<HTMLElement>>('content');

  header = PRINT_HEADER;
  axisW = AXIS_W;
  today = new Date();
  project = signal<StudyProject | null>(null);
  tasks = signal<StageTask[]>([]);
  error = signal('');
  withTasks = signal(false);
  /** معامل التصغير ليبقى المخطط في صفحة */
  scale = signal(1);

  hasTasks = computed(() => this.tasks().length > 0);
  /** بلغ التصغير حدّه الأدنى ولا يزال المخطط أطول من صفحة */
  tooTall = computed(() => this.scale() <= 0.56);

  constructor() {
    const id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
    forkJoin({ project: this.service.get(id), tasks: this.service.projectTasks(id) }).subscribe({
      next: r => { this.project.set(r.project); this.tasks.set(r.tasks); },
      error: e => this.error.set(e.message)
    });
    // القياس بعد رسم المخطط: المراحل وحدها لا تُصغَّر، ومع المهام يُصغَّر إلى أن يتسع الارتفاع المتاح
    effect(() => {
      this.project(); this.withTasks();
      untracked(() => setTimeout(() => this.fitHeight(), 150));
    });
  }

  private fitHeight() {
    const el = this.content()?.nativeElement;
    if (!el) return;
    this.scale.set(1);
    requestAnimationFrame(() => {
      const h = el.offsetHeight;
      this.scale.set(h > AVAILABLE_H ? Math.max(0.55, AVAILABLE_H / h) : 1);
    });
  }

  print() { window.print(); }
}
