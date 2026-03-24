import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * JWT payload에서 유저 ID(sub)를 추출하는 데코레이터.
 * AuthGuard와 함께 사용해야 한다.
 *
 * @example
 * @UseGuards(AuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: jwt.JwtPayload }>();
    return request.user.sub as string;
  },
);
