export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}
