import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/** AI API 제공자 */
type AiProvider = 'claude' | 'openai';

/** AI 응답 */
interface AiResponse {
  content: string;
  tokensUsed: number;
}

/**
 * AI API 래퍼 서비스.
 * Claude와 GPT-4o를 교체 가능하게 래핑한다.
 * 마이북 요약, 페이스메이커 발화, 커뮤니티 태그 추출에 공통 사용.
 */
@Injectable()
export class AiService {
  private readonly provider: AiProvider;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.provider = (this.configService.get<string>('AI_API_PROVIDER') ?? 'claude') as AiProvider;
    this.apiKey = this.configService.get<string>('AI_API_KEY') ?? '';
  }

  /**
   * AI에 텍스트 생성을 요청한다.
   * @param systemPrompt - 시스템 프롬프트
   * @param userMessage - 유저 메시지
   * @param maxTokens - 최대 토큰 수
   * @returns AI 응답
   */
  async generateText(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number = 500,
  ): Promise<AiResponse> {
    if (!this.apiKey) {
      this.logger.warn('AI API 키가 설정되지 않음. 더미 응답 반환.', 'AiService');
      return {
        content: '[AI 응답 대기 중 — API 키 미설정]',
        tokensUsed: 0,
      };
    }

    try {
      if (this.provider === 'claude') {
        return await this.callClaude(systemPrompt, userMessage, maxTokens);
      } else {
        return await this.callOpenAI(systemPrompt, userMessage, maxTokens);
      }
    } catch (err) {
      this.logger.error(
        `AI API 호출 실패: ${(err as Error).message}`,
        undefined,
        'AiService',
      );
      return {
        content: '[AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.]',
        tokensUsed: 0,
      };
    }
  }

  /**
   * Claude API를 호출한다.
   */
  private async callClaude(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): Promise<AiResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = (await response.json()) as {
      content: { text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };

    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    this.logger.log(`Claude API 호출: ${tokensUsed} 토큰 사용`, 'AiService');

    return {
      content: data.content?.[0]?.text ?? '',
      tokensUsed,
    };
  }

  /**
   * OpenAI API를 호출한다.
   */
  private async callOpenAI(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): Promise<AiResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage: { total_tokens: number };
    };

    const tokensUsed = data.usage?.total_tokens ?? 0;

    this.logger.log(`OpenAI API 호출: ${tokensUsed} 토큰 사용`, 'AiService');

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      tokensUsed,
    };
  }
}
