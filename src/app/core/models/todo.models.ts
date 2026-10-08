// تطابق Application/DTOs/Response/ToDoListResponseDto.cs — «مفكرتي»: قوائم المهام الشخصية وبنودها

export type ToDoRepeat = 'Daily' | 'Weekly' | 'Monthly';
/** قيم الـ API الرقمية للتكرار (0 = بلا تكرار) */
export const TODO_REPEAT_VALUE: Record<ToDoRepeat | 'None', number> = { None: 0, Daily: 1, Weekly: 2, Monthly: 3 };
export const TODO_REPEAT_LABEL: Record<ToDoRepeat, string> = { Daily: 'يومياً', Weekly: 'أسبوعياً', Monthly: 'شهرياً' };

export interface ToDoLinkedTask {
  id: number;
  /** false: لم يعد يحق لك عرض المهمة (لا بيانات) */
  available: boolean;
  title: string;
  status: string;
  statusAr: string;
  isOverdue: boolean;
}

export interface ToDoItem {
  id: number;
  toDoListId: number;
  title: string;
  isDone: boolean;
  doneAt: string | null;
  sortOrder: number;
  note: string;
  isImportant: boolean;
  dueDate: string | null;
  isOverdue: boolean;
  repeat: ToDoRepeat | null;
  repeatAr: string | null;
  lastCompletedAt: string | null;
  linkedTask: ToDoLinkedTask | null;
}

export interface ToDoList {
  id: number;
  name: string;
  description: string;
  userId: number;
  ownerName: string;
  color: string;
  icon: string;
  isPinned: boolean;
  isArchived: boolean;
  itemsTotal: number;
  itemsDone: number;
  itemsOverdue: number;
  nextDueDate: string | null;
  /** فارغة في القائمة الرئيسية (الأعداد تكفي)، ومملوءة في تفصيل القائمة وعمليات البنود */
  items: ToDoItem[];
}

export interface ToDoTodayItem extends ToDoItem { listName: string; listColor: string; listIcon: string; }
export interface ToDoToday { overdueCount: number; todayCount: number; items: ToDoTodayItem[]; }

export interface SaveToDoListRequest { name: string; description: string; color: string; icon: string; }
export interface NewToDoItem { title: string; note?: string; isImportant?: boolean; dueDate?: string | null; repeat?: number | null; }
export interface ToDoItemChange {
  title?: string; isDone?: boolean; note?: string; isImportant?: boolean;
  dueDate?: string; clearDueDate?: boolean; repeat?: number;
}

/** الحدود نفسها في الباكاند (ToDoRules) */
export const TODO_LIMITS = { maxItems: 200, titleLength: 200, noteLength: 1000, bulk: 100, nameLength: 200, descriptionLength: 2000 } as const;

/** ألوان القوائم المسموحة (مفاتيح ثابتة في الخادم) ← متغيّر لون من رموز التصميم */
export const TODO_COLORS: { key: string; label: string; css: string }[] = [
  { key: 'green', label: 'أخضر', css: 'var(--brand-600)' },
  { key: 'blue', label: 'أزرق', css: 'var(--info-500)' },
  { key: 'purple', label: 'بنفسجي', css: 'var(--purple-500)' },
  { key: 'orange', label: 'برتقالي', css: 'var(--warning-500)' },
  { key: 'red', label: 'أحمر', css: 'var(--danger-500)' },
  { key: 'gray', label: 'رمادي', css: 'var(--ink-400)' }
];
export const todoColor = (key: string) => TODO_COLORS.find(c => c.key === key)?.css ?? 'var(--brand-600)';
export const TODO_ICONS = ['📝', '📌', '🏠', '💼', '🛒', '📚', '✈️', '💡', '🎯', '🔧'];
