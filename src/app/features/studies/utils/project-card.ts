import { ProjectStage, StudyProject } from '../data-access/studies.models';
import { StudyProjectStatus, StudyStageStatus } from '../data-access/models/enums.models';

/** حالة جزء في شريط المراحل: مغلقة، جارية، متأخرة (فات تاريخ نهايتها ولم تُغلق)، لم تبدأ */
export type StageState = 'closed' | 'active' | 'late' | 'todo';
export interface StageSegment { id: number; name: string; state: StageState; title: string; }

const DAY = 86_400_000;
const STATE_LABEL: Record<StageState, string> = { closed: 'مغلقة', active: 'جارية', late: 'متأخرة', todo: 'لم تبدأ' };

/** تاريخ الخادم (yyyy-MM-dd…) كيوم محلي بلا ساعة؛ null إن لم يوجد */
function dayOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : null;
}
const todayOf = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

/** المشروع متأخر: جارٍ، وفات تاريخ نهايته المخطط، ولم يبلغ 100% */
export function isProjectLate(p: Pick<StudyProject, 'status' | 'plannedEndDate' | 'progress'>, now = new Date()): boolean {
  const end = dayOf(p.plannedEndDate);
  return p.status === StudyProjectStatus.Running && end != null && end < todayOf(now) && p.progress < 100;
}

/** الأيام الباقية حتى نهاية المشروع المخططة (سالبة إن فاتت)، أو null لمشروع غير جارٍ أو بلا تاريخ */
export function daysLeft(p: Pick<StudyProject, 'status' | 'plannedEndDate'>, now = new Date()): number | null {
  const end = dayOf(p.plannedEndDate);
  return p.status === StudyProjectStatus.Running && end != null ? Math.round((end - todayOf(now)) / DAY) : null;
}

/** «باقٍ 12 يوماً» / «ينتهي اليوم» / «متأخر 5 أيام» */
export function daysLeftText(days: number | null): string {
  if (days == null) return '';
  if (days === 0) return 'ينتهي اليوم';
  const n = Math.abs(days);
  const unit = n === 1 ? 'يوماً واحداً' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوماً`;
  return days > 0 ? `باقٍ ${unit}` : `متأخر ${unit}`;
}

/**
 * شريط المراحل في بطاقة المشروع: مراحل العمل فقط بترتيبها (مراحل المستندات تُغلق مع إنشاء المشروع فلا تقول شيئاً عن تقدمه).
 * مرحلة غير مغلقة فات تاريخ نهايتها المخطط = متأخرة.
 */
export function stageStrip(stages: readonly ProjectStage[], now = new Date()): StageSegment[] {
  const today = todayOf(now);
  return [...stages]
    .filter(s => s.linkedDocument === 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(s => {
      const end = dayOf(s.plannedEndDate);
      const state: StageState = s.status === StudyStageStatus.Closed ? 'closed'
        : end != null && end < today ? 'late'
        : s.status === StudyStageStatus.InProgress ? 'active' : 'todo';
      return { id: s.id, name: s.stageTypeName, state, title: `${s.stageTypeName}: ${STATE_LABEL[state]} · ${Math.round(s.progress)}%` };
    });
}

/** المرحلة الحالية: أول مرحلة غير مغلقة في الشريط (متأخرة أو جارية أو التالية) */
export function currentStage(strip: readonly StageSegment[]): StageSegment | null {
  return strip.find(s => s.state !== 'closed') ?? null;
}
