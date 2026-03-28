import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UpsertUserDto } from './dto/upsert-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * NextAuth.js の jwt コールバックから呼ばれる内部エンドポイント。
   * Google ユーザー情報でDBにユーザーをupsertし、バックエンドJWTを返す。
   */
  @Post('upsert')
  async upsert(@Body() dto: UpsertUserDto): Promise<{ accessToken: string }> {
    const accessToken = await this.authService.upsertAndIssueToken(dto);
    return { accessToken };
  }
}
