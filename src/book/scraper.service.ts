import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface ScrapMetadata {
  channel: 'youtube' | 'threads' | 'instagram' | 'other';
  creator: string | null;
  contentDate: string | null;
  title: string | null;
  aiSummary: string | null;
}

@Injectable()
export class ScraperService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async scrapeUrl(url: string): Promise<ScrapMetadata> {
    const channel = this.detectChannel(url);

    // 메타데이터 추출 시도
    let title: string | null = null;
    let creator: string | null = null;
    let contentDate: string | null = null;
    let aiSummary: string | null = null;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MoneyRun/1.0' },
      });

      if (response.ok) {
        const html = await response.text();
        title = this.extractTitle(html);
        creator = this.extractCreator(html, channel);
      }
    } catch {
      // 메타데이터 추출 실패해도 계속 진행
    }

    // AI 요약 (youtube, other만)
    if (channel === 'youtube' || channel === 'other') {
      aiSummary = await this.generateSummary(url, title, channel);
    }

    return { channel, creator, contentDate, title, aiSummary };
  }

  private detectChannel(url: string): ScrapMetadata['channel'] {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('threads.net')) return 'threads';
    if (lower.includes('instagram.com')) return 'instagram';
    return 'other';
  }

  private extractTitle(html: string): string | null {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
    if (ogTitle) return ogTitle[1];

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag) return titleTag[1].trim();

    return null;
  }

  private extractCreator(html: string, channel: string): string | null {
    if (channel === 'youtube') {
      const match = html.match(/"ownerChannelName":"([^"]*)"/);
      if (match) return match[1];
    }

    const author = html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"[^>]*>/i);
    if (author) return author[1];

    return null;
  }

  private async generateSummary(
    url: string,
    title: string | null,
    channel: string,
  ): Promise<string | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6-20260403',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `다음 ${channel === 'youtube' ? '유튜브 영상' : '웹페이지'}의 핵심 내용을 300자 이내로 요약해줘.
URL: ${url}
${title ? `제목: ${title}` : ''}

규칙:
1. 금융/경제 관점에서 핵심만 요약
2. 한국어로 자연스럽게
3. 300자 이내
4. 요약만 출력 (다른 텍스트 없이)`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return text.trim() || null;
    } catch {
      return null;
    }
  }
}
