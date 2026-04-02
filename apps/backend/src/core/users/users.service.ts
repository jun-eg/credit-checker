import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

export interface UpsertUserParams {
  googleId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async upsertByGoogle(params: UpsertUserParams): Promise<User> {
    const existing = await this.usersRepository.findOneBy({
      googleId: params.googleId,
    });

    if (existing) {
      // 最新のプロフィール情報に更新
      existing.displayName = params.displayName;
      existing.avatarUrl = params.avatarUrl;
      return this.usersRepository.save(existing);
    }

    const emailUser = await this.usersRepository.findOneBy({
      email: params.email,
    });

    if (emailUser) {
      // 既存メールアドレスにgoogleIdを紐付け
      emailUser.googleId = params.googleId;
      emailUser.displayName = params.displayName;
      emailUser.avatarUrl = params.avatarUrl;
      return this.usersRepository.save(emailUser);
    }

    const newUser = this.usersRepository.create({
      googleId: params.googleId,
      email: params.email,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
    });
    return this.usersRepository.save(newUser);
  }
}
