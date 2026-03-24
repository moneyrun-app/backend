import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Winston 로거 설정을 생성한다.
 * @param nodeEnv - 현재 환경 (development | production)
 * @returns Winston 모듈 옵션
 */
export function createWinstonConfig(nodeEnv: string): WinstonModuleOptions {
  const isProduction = nodeEnv === 'production';

  const dailyRotateInfoTransport = new DailyRotateFile({
    dirname: 'logs/%DATE%',
    filename: '%DATE%-info.log',
    datePattern: 'YYYY-MM/DD',
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json(),
    ),
    zippedArchive: true,
  });

  const dailyRotateErrorTransport = new DailyRotateFile({
    dirname: 'logs/%DATE%',
    filename: '%DATE%-error.log',
    datePattern: 'YYYY-MM/DD',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json(),
    ),
    zippedArchive: true,
  });

  const transports: winston.transport[] = [
    dailyRotateInfoTransport,
    dailyRotateErrorTransport,
  ];

  // 개발 환경에서는 콘솔에 컬러 출력
  if (!isProduction) {
    transports.push(
      new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context }) => {
            return `${timestamp as string} [${level}] [${(context as string) ?? 'App'}] ${message as string}`;
          }),
        ),
      }),
    );
  }

  return {
    level: isProduction ? 'info' : 'debug',
    transports,
  };
}
