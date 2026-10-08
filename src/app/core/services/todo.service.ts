import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { SaveToDoListRequest, ToDoList } from '../models/todo.models';

/** قوائم المهام الشخصية وبنودها — كل عملية على البنود تُرجع القائمة كاملة بعد التحديث */
@Injectable({ providedIn: 'root' })
export class ToDoService {
  private api = inject(ApiService);

  lists(ownerId?: number) { return this.api.get<ToDoList[]>(`/ToDoLists/GetAll${ownerId ? `?ownerId=${ownerId}` : ''}`); }
  get(id: number) { return this.api.get<ToDoList>(`/ToDoLists/Get/${id}`); }
  create(body: SaveToDoListRequest) { return this.api.post<ToDoList>('/ToDoLists/Create', body); }
  update(id: number, body: SaveToDoListRequest) { return this.api.put<ToDoList>(`/ToDoLists/Update/${id}`, body); }
  delete(id: number) { return this.api.delete<{ message: string }>(`/ToDoLists/Delete/${id}`); }

  addItem(listId: number, title: string) { return this.api.post<ToDoList>(`/ToDoLists/Items/${listId}`, { title }); }
  updateItem(itemId: number, change: { title?: string; isDone?: boolean }) { return this.api.put<ToDoList>(`/ToDoLists/Item/${itemId}`, change); }
  deleteItem(itemId: number) { return this.api.delete<ToDoList>(`/ToDoLists/Item/${itemId}`); }
  reorder(listId: number, itemIds: number[]) { return this.api.put<ToDoList>(`/ToDoLists/Reorder/${listId}`, { itemIds }); }
  clearDone(listId: number) { return this.api.delete<ToDoList>(`/ToDoLists/ClearDone/${listId}`); }
}
