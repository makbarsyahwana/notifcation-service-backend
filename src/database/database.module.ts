import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { existsSync } from 'node:fs';

const rawEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'local';
const isTest = rawEnv === 'test';
const appEnv = rawEnv === 'development' ? 'dev' : rawEnv;
const supportedEnvs = new Set(['local', 'dev', 'staging', 'production']);

const envFileCandidates = isTest
  ? []
  : [
      ...(supportedEnvs.has(appEnv) ? [`.env.${appEnv}`] : []),
      '.env',
    ];

const envFilePath = envFileCandidates.filter((p) => existsSync(p));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ...(envFilePath.length
        ? { envFilePath }
        : { ignoreEnvFile: true }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ??
          'mongodb://localhost:27017/birthday_reminder',
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
