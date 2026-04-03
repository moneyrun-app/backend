import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger('요청');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, headers } = req;
    const ip = req.ip || req.headers['x-forwarded-for'] || '알수없음';
    const userAgent = headers['user-agent'] || '알수없음';
    const userId = req.user?.id || '비로그인';
    const start = Date.now();
    const time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    const bodyStr = Object.keys(body || {}).length ? ` | 바디: ${JSON.stringify(body)}` : '';

    this.logger.log(
      `[수신] ${time} | IP: ${ip} | ${method} ${url} | 유저: ${userId}${bodyStr} | UA: ${userAgent}`,
    );

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const duration = Date.now() - start;
        this.logger.log(
          `[응답] ${time} | IP: ${ip} | ${method} ${url} | 상태: ${res.statusCode} | 소요: ${duration}ms`,
        );
      }),
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
