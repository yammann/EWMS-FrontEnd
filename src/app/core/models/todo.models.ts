// تطابق Application/DTOs/Response/ToDoListResponseDto.cs — قوائم المهام الشخصية وبنودها

export interface ToDoItem {
  id: number;
  toDoListId: number;
  title: string;
  isDone: boolean;
  doneAt: string | null;
  sortOrder: number;
}

export interface ToDoList {
  id: number;
  name: string;
  description: string;
  userId: number;
  ownerName: string;
  itemsTotal: number;
  itemsDone: number;
  /** فارغة في القائمة الرئيسية (الأعداد تكفي)، ومملوءة في تفصيل القائمة وعمليات البنود */
  items: ToDoItem[];
}

export interface SaveToDoListRequest { name: string; description: string; }

/** الحدود نفسها في الباكاند (ToDoItemRules) */
export const TODO_LIMITS = { maxItems: 200, titleLength: 200, nameLength: 200, descriptionLength: 2000 } as const;
