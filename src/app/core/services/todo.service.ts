import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { NewToDoItem, SaveToDoListRequest, ToDoItemChange, ToDoList, ToDoToday } from '@core/models/todo.models';

/** «مفكرتي»: قوائم المهام الشخصية وبنودها — كل عملية على البنود تُرجع القائمة كاملة بعد التحديث */
@Injectable({ providedIn: 'root' })
export class ToDoService {
  private api = inject(ApiService);

  lists(ownerId?: number) { return this.api.get<ToDoList[]>(`/ToDoLists/GetAll${ownerId ? `?ownerId=${ownerId}` : ''}`); }
  get(id: number) { return this.api.get<ToDoList>(`/ToDoLists/Get/${id}`); }
  create(body: SaveToDoListRequest) { return this.api.post<ToDoList>('/ToDoLists/Create', body); }
  update(id: number, body: SaveToDoListRequest) { return this.api.put<ToDoList>(`/ToDoLists/Update/${id}`, body); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/ToDoLists/Delete/${id}`); }

  pin(id: number, value: boolean) { return this.api.put<ToDoList>(`/ToDoLists/Pin/${id}`, { value }); }
  archive(id: number, value: boolean) { return this.api.put<ToDoList>(`/ToDoLists/Archive/${id}`, { value }); }
  duplicate(id: number) { return this.api.post<ToDoList>(`/ToDoLists/Duplicate/${id}`, {}); }
  today() { return this.api.get<ToDoToday>('/ToDoLists/Today'); }

  addItem(listId: number, item: NewToDoItem | string) {
    const body = typeof item === 'string' ? { title: item } : item;
    return this.api.post<ToDoList>(`/ToDoLists/Items/${listId}`, body);
  }
  bulkAdd(listId: number, titles: string[]) { return this.api.post<ToDoList>(`/ToDoLists/Items/${listId}/Bulk`, { titles }); }
  addTask(listId: number, taskId: number) { return this.api.post<ToDoList>(`/ToDoLists/Items/${listId}/FromTask`, { taskId }); }
  updateItem(itemId: number, change: ToDoItemChange) { return this.api.put<ToDoList>(`/ToDoLists/Item/${itemId}`, change); }
  deleteItem(itemId: number) { return this.api.delete<ToDoList>(`/ToDoLists/Item/${itemId}`); }
  reorder(listId: number, itemIds: number[]) { return this.api.put<ToDoList>(`/ToDoLists/Reorder/${listId}`, { itemIds }); }
  clearDone(listId: number) { return this.api.delete<ToDoList>(`/ToDoLists/ClearDone/${listId}`); }
}
