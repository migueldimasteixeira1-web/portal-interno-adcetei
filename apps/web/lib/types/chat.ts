export interface ChatContact {
  id: number;
  full_name: string;
  role: string;
  secretariat: string;
  department: string;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export interface ChatConversation {
  contact: ChatContact;
  last_message?: ChatMessage | null;
  unread_count: number;
}
