interface MessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export class ListMessagesResponseDto {
  messages: MessageDto[];
}
