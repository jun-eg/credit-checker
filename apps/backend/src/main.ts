import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
  await app.listen(process.env.BACKEND_PORT ?? 3003);
}
void bootstrap();
