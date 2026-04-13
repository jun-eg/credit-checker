interface SessionDto {
  id: string;
  title: string | null;
  createdAt: Date;
}

export class ListSessionsResponseDto {
  sessions: SessionDto[];
}
