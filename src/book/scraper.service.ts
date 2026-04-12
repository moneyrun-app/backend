import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { fetchYoutubeTranscript } from './youtube-transcript';

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

    let title: string | null = null;
    let creator: string | null = null;
    let contentDate: string | null = null;
    let aiSummary: string | null = null;
    let bodyText: string | null = null;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoneyRun/1.0)' },
      });

      if (response.ok) {
        const html = await response.text();
        title = this.extractTitle(html);
        creator = this.extractCreator(html, channel);
        bodyText = this.extractBodyText(html);
      }
    } catch {
      // 메타데이터 추출 실패해도 계속 진행
    }

    // AI 요약
    if (channel === 'youtube') {
      aiSummary = await this.summarizeYoutube(url, title);
    } else {
      aiSummary = await this.summarizeWebPage(url, title, bodyText);
    }

    return { channel, creator, contentDate, title, aiSummary };
  }

  /** 유튜브: 자막 추출 → Claude 요약 */
  private async summarizeYoutube(url: string, title: string | null): Promise<string | null> {
    let transcript = '';

    try {
      const items = await fetchYoutubeTranscript(url, 'ko');
      transcript = items.map((item) => item.text).join(' ');
    } catch {
      // 한국어 자막 없으면 기본 언어로 시도
      try {
        const items = await fetchYoutubeTranscript(url);
        transcript = items.map((item) => item.text).join(' ');
      } catch {
        // 자막 없는 영상 → 제목 기반 요약
        if (!title) return null;
        return this.generateSummary(
          `유튜브 영상 제목: "${title}"\n(자막을 가져올 수 없는 영상입니다. 제목을 바탕으로 간단히 요약해주세요.)`,
          '(자막 없음) ',
        );
      }
    }

    if (!transcript) return null;

    // 자막이 너무 길면 앞 3000자만
    const trimmed = transcript.length > 3000 ? transcript.substring(0, 3000) + '...' : transcript;

    return this.generateSummary(
      `유튜브 영상 자막 내용:\n${trimmed}${title ? `\n\n영상 제목: ${title}` : ''}`,
      '',
    );
  }

  /** 일반 웹페이지: 본문 텍스트 기반 요약 */
  private async summarizeWebPage(url: string, title: string | null, bodyText: string | null): Promise<string | null> {
    if (!bodyText && !title) return null;

    const content = bodyText
      ? `다음 웹페이지의 핵심 내용을 요약해줘.\n제목: ${title || '없음'}\n본문:\n${bodyText.substring(0, 3000)}`
      : `다음 웹페이지의 핵심 내용을 제목을 바탕으로 요약해줘.\nURL: ${url}\n제목: ${title}`;

    return this.generateSummary(content, '');
  }

  private async generateSummary(content: string, prefix: string): Promise<string | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `${content}

규칙:
1. 금융/경제 관점에서 핵심만 요약
2. 한국어로 자연스럽게
3. 300자 이내
4. 요약만 출력 (다른 텍스트 없이)`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return text.trim() ? prefix + text.trim() : null;
    } catch {
      return null;
    }
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

  private extractBodyText(html: string): string | null {
    // script, style, nav, header, footer 태그 제거
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '');

    // article 또는 main 태그 내용 우선 추출
    const article = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
    const main = cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
    const target = article?.[1] || main?.[1] || cleaned;

    // HTML 태그 제거 → 텍스트만
    const text = target
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    return text.length > 50 ? text : null;
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
}
