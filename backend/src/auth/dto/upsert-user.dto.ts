export class UpsertUserDto {
  googleId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}
