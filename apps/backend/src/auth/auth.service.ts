import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService, UpsertUserParams } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async upsertAndIssueToken(params: UpsertUserParams): Promise<string> {
    const user = await this.usersService.upsertByGoogle(params);
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }
}
