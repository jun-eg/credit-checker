import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { ChatService } from './chat.service';
import { CreateSessionResponseDto } from './dto/create-session.response.dto';
import { ListMessagesResponseDto } from './dto/list-messages.response.dto';
import { ListSessionsResponseDto } from './dto/list-sessions.response.dto';
import { SendMessageRequestDto } from './dto/send-message.request.dto';
import { SendMessageResponseDto } from './dto/send-message.response.dto';
import { UpdateSessionRequestDto } from './dto/update-session.request.dto';
import { UpdateSessionResponseDto } from './dto/update-session.response.dto';
import { MessageRole } from '../entities/chat-message.entity';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  async createSession(
    @CurrentUser() user: User,
  ): Promise<CreateSessionResponseDto> {
    const session = await this.chatService.createSession(user.id);
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
    };
  }

  @Get('sessions')
  async getSessions(
    @CurrentUser() user: User,
  ): Promise<ListSessionsResponseDto> {
    const sessions = await this.chatService.getSessions(user.id);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
      })),
    };
  }

  @Patch('sessions/:id')
  async updateSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSessionRequestDto,
  ): Promise<UpdateSessionResponseDto> {
    const session = await this.chatService.updateSessionTitle(
      id,
      user.id,
      body.title,
    );
    return {
      id: session.id,
      title: session.title ?? '',
      createdAt: session.createdAt,
    };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async deleteSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.chatService.deleteSession(id, user.id);
  }

  @Get('sessions/:id/messages')
  async getMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListMessagesResponseDto> {
    const messages = await this.chatService.getMessages(id, user.id);
    // tool ロールの内部メッセージはフロントエンドに返さない
    const visible = messages.filter(
      (m) =>
        m.role === MessageRole.USER ||
        (m.role === MessageRole.ASSISTANT && m.toolName !== '__tool_calls__'),
    );
    return {
      messages: visible.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageRequestDto,
  ): Promise<SendMessageResponseDto> {
    const reply = await this.chatService.sendMessage(id, user.id, body.message);
    return { reply, sessionId: id };
  }
}
