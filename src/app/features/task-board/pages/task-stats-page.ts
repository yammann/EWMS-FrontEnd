import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import { TaskStats } from '../data-access/assigned-task.models';
import { StatTile } from '@shared/ui/stat-tile';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { latestRequest } from '@shared/ui/track-request';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * إحصائيات المهام لمن يملك ViewTaskStats، ضمن مهام نطاقه فقط: الإنجاز في الموعد، متوسط زمن التنفيذ، المتأخرات،
 * وجدول لكل جهة (قسم/مكتب/موظف) وحركة الأشهر. الفترة تُحسب على تاريخ إنشاء المهمة.
 */
@Component({
  selector: 'app-task-stats-page', standalone: true, imports: [PageHeader, EmptyState, Alert, FormsModule, StatTile],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss', './task-stats-page.scss'],
  templateUrl: './task-stats-page.html',
  
})
export class TaskStatsPage {
  /** تحميل الصفحة: كل تحميل يلغي السابق (لا يستبدل ردٌّ متأخر النتيجةَ الأحدث) */
  private latest = latestRequest();
  private service = inject(AssignedTaskService);

  from = signal(iso(new Date(Date.now() - 90 * 86_400_000)));
  to = signal(iso(new Date()));
  stats = signal<TaskStats | null>(null);
  loading = signal(false);
  error = signal('');

  monthMax = computed(() => Math.max(1, ...(this.stats()?.byMonth.flatMap(m => [m.created, m.done]) ?? [])));
  monthsLabel = computed(() => (this.stats()?.byMonth ?? []).map(m => `${this.monthName(m.month)}: أُنشئت ${m.created}، أُنجزت ${m.done}`).join('، '));

  constructor() { this.load(); }

  rate = (v: number | null) => v === null ? '—' : `${v}%`;
  monthName(month: string) { const [y, m] = month.split('-'); return `${MONTHS[Number(m) - 1]} ${y}`; }

  preset(days: number) {
    this.to.set(iso(new Date()));
    this.from.set(iso(new Date(Date.now() - days * 86_400_000)));
    this.load();
  }

  load() {
    this.latest(this.service.stats(this.from(), this.to()), this.loading, this.error, s => { this.stats.set(s); });
  }
}
