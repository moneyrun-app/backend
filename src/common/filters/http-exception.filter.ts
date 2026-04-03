import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  402: 'PAYMENT_REQUIRED',
  404: 'NOT_FOUND',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('에러');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const ip = request.ip || request.headers['x-forwarded-for'] || '알수없음';
    const time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '서버 오류가 발생했습니다.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;

      if (Array.isArray(message)) {
        message = message.join(', ');
      }
    } else if (exception instanceof Error) {
      // 일반 Error — 스택트레이스 출력
      this.logger.error(`[상세] ${exception.message}`, exception.stack);
    }

    this.logger.warn(
      `[실패] ${time} | IP: ${ip} | ${request.method} ${request.url} | 상태: ${status} | 사유: ${message}`,
    );

    response.status(status).json({
      success: false,
      message,
      code: STATUS_CODE_MAP[status] || 'INTERNAL_ERROR',
    });
  }
}
