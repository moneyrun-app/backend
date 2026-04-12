import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';

@Injectable()
export class MyBookService {
  private anthropic: Anthropic;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ========== 마이북 개요 ==========

  async getOverview(userId: string) {
    // 1. 최신 상세 리포트 (머니레터)
    const { data: latestReport } = await this.supabase.db
      .from('detailed_reports')
      .select('id, summary, grade, report_version, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 2. 구매한 책 목록 (LEFT JOIN money_books)
    const { data: purchases } = await this.supabase.db
      .from('user_purchases')
      .select('id, book_id, source, status, personalized_chapters, created_at, book:money_books (title, category, cover_image_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 3. 각 구매별 하이라이트 수 조회
    const purchaseIds = (purchases || []).map((p: any) => p.id);
    let highlightCountsByPurchase: Record<string, number> = {};

    if (purchaseIds.length > 0) {
      const { data: highlights } = await this.supabase.db
        .from('user_book_highlights')
        .select('purchase_id')
        .eq('user_id', userId);

      (highlights || []).forEach((h: any) => {
        highlightCountsByPurchase[h.purchase_id] = (highlightCountsByPurchase[h.purchase_id] || 0) + 1;
      });
    }

    // 4. 전체 하이라이트 수
    const { count: totalHighlightCount } = await this.supabase.db
      .from('user_book_highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 5. 스크랩 수 (external_scraps + user_quiz_scraps)
    const { count: urlScrapCount } = await this.supabase.db
      .from('external_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: quizScrapCount } = await this.supabase.db
      .from('user_quiz_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalScrapCount = (urlScrapCount || 0) + (quizScrapCount || 0);

    // 응답 조립
    const purchasedBooks = (purchases || []).map((p: any) => {
      const isScrapBased = p.source === 'scrap';
      const chapters = p.personalized_chapters as any[];
      const bookTitle = isScrapBased
        ? (chapters && chapters.length > 0 ? (chapters[0]?.bookTitle || '나만의 머니북') : '나만의 머니북')
        : (p.book?.title || '');

      return {
        purchaseId: p.id,
        bookId: p.book_id,
        bookTitle,
        category: isScrapBased ? 'scrap-generated' : (p.book?.category || ''),
        coverImageUrl: isScrapBased ? null : (p.book?.cover_image_url || null),
        source: p.source,
        status: p.status,
        highlightCount: highlightCountsByPurchase[p.id] || 0,
        createdAt: p.created_at,
      };
    });

    return {
      detailedReport: latestReport
        ? {
            id: latestReport.id,
            summary: latestReport.summary,
            grade: latestReport.grade,
            reportVersion: latestReport.report_version,
            createdAt: latestReport.created_at,
          }
        : null,
      purchasedBooks,
      highlightCount: totalHighlightCount || 0,
      scrapCounts: {
        url: urlScrapCount || 0,
        quiz: quizScrapCount || 0,
        total: totalScrapCount,
      },
      canGenerateBook: totalScrapCount >= 100,
    };
  }

  // ========== 구매한 책 읽기 ==========

  async getBook(userId: string, purchaseId: string) {
    const { data: purchase, error } = await this.supabase.db
      .from('user_purchases')
      .select('id, user_id, book_id, source, status, personalized_chapters, scrap_snapshot, created_at, completed_at, book:money_books (title, description, category, cover_image_url)')
      .eq('id', purchaseId)
      .single();

    if (error || !purchase) {
      throw new NotFoundException('구매한 책을 찾을 수 없습니다.');
    }

    if (purchase.user_id !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    // 해당 구매의 하이라이트 조회
    const { data: highlights } = await this.supabase.db
      .from('user_book_highlights')
      .select('id, chapter_index, sentence_text, color, note, created_at')
      .eq('purchase_id', purchaseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // 챕터별 하이라이트 매핑
    const highlightsByChapter: Record<number, any[]> = {};
    (highlights || []).forEach((h: any) => {
      if (!highlightsByChapter[h.chapter_index]) {
        highlightsByChapter[h.chapter_index] = [];
      }
      highlightsByChapter[h.chapter_index].push({
        id: h.id,
        sentenceText: h.sentence_text,
        color: h.color,
        note: h.note,
        createdAt: h.created_at,
      });
    });

    const chapters = (purchase.personalized_chapters as any[] || []).map((ch: any, index: number) => ({
      ...ch,
      chapterIndex: index,
      highlights: highlightsByChapter[index] || [],
    }));

    const isScrapBased = purchase.source === 'scrap';
    const book = purchase.book as any;

    return {
      purchaseId: purchase.id,
      bookId: purchase.book_id,
      bookTitle: isScrapBased
        ? (chapters.length > 0 ? (chapters[0]?.bookTitle || '나만의 머니북') : '나만의 머니북')
        : (book?.title || ''),
      bookDescription: isScrapBased ? null : (book?.description || null),
      category: isScrapBased ? 'scrap-generated' : (book?.category || ''),
      coverImageUrl: isScrapBased ? null : (book?.cover_image_url || null),
      source: purchase.source,
      status: purchase.status,
      chapters,
      createdAt: purchase.created_at,
      completedAt: purchase.completed_at,
    };
  }

  // ========== 하이라이트 추가 ==========

  async addHighlight(userId: string, purchaseId: string, dto: CreateHighlightDto) {
    // 구매 소유권 확인
    const { data: purchase, error: purchaseError } = await this.supabase.db
      .from('user_purchases')
      .select('id, user_id')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      throw new NotFoundException('구매한 책을 찾을 수 없습니다.');
    }

    if (purchase.user_id !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    const { data: highlight, error } = await this.supabase.db
      .from('user_book_highlights')
      .insert({
        user_id: userId,
        purchase_id: purchaseId,
        chapter_index: dto.chapterIndex,
        sentence_text: dto.sentenceText,
        color: dto.color,
        note: dto.note || null,
      })
      .select('id, chapter_index, sentence_text, color, note, created_at')
      .single();

    if (error) {
      throw new Error(`하이라이트 저장 실패: ${error.message}`);
    }

    return {
      id: highlight!.id,
      purchaseId,
      chapterIndex: highlight!.chapter_index,
      sentenceText: highlight!.sentence_text,
      color: highlight!.color,
      note: highlight!.note,
      createdAt: highlight!.created_at,
    };
  }

  // ========== 하이라이트 삭제 ==========

  async deleteHighlight(userId: string, highlightId: string) {
    const { data: existing } = await this.supabase.db
      .from('user_book_highlights')
      .select('id')
      .eq('id', highlightId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw new NotFoundException('하이라이트를 찾을 수 없습니다.');
    }

    const { error } = await this.supabase.db
      .from('user_book_highlights')
      .delete()
      .eq('id', highlightId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`하이라이트 삭제 실패: ${error.message}`);
    }
  }

  // ========== 전체 하이라이트 조회 ==========

  async getAllHighlights(userId: string, color?: string) {
    let query = this.supabase.db
      .from('user_book_highlights')
      .select('id, purchase_id, chapter_index, sentence_text, color, note, created_at, purchase:user_purchases (book_id, source, personalized_chapters, book:money_books (title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (color) {
      query = query.eq('color', color);
    }

    const { data: highlights } = await query;

    return (highlights || []).map((h: any) => {
      const purchase = h.purchase as any;
      const isScrapBased = purchase?.source === 'scrap';
      const chapters = purchase?.personalized_chapters as any[];
      const bookTitle = isScrapBased
        ? (chapters && chapters.length > 0 ? (chapters[0]?.bookTitle || '나만의 머니북') : '나만의 머니북')
        : (purchase?.book?.title || '');

      return {
        id: h.id,
        purchaseId: h.purchase_id,
        bookTitle,
        chapterIndex: h.chapter_index,
        sentenceText: h.sentence_text,
        color: h.color,
        note: h.note,
        createdAt: h.created_at,
      };
    });
  }

  // ========== 스크랩 통합 조회 ==========

  async getScraps(userId: string, type?: string) {
    const result: { urlScraps: any[]; quizScraps: any[]; highlightScraps: any[]; totalCount: number } = {
      urlScraps: [],
      quizScraps: [],
      highlightScraps: [],
      totalCount: 0,
    };

    // URL 스크랩
    if (!type || type === 'url') {
      const { data: urlScraps } = await this.supabase.db
        .from('external_scraps')
        .select('id, url, channel, creator, title, body_text, og_image_url, ai_summary, scrap_count, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      result.urlScraps = (urlScraps || []).map((s: any) => ({
        id: s.id,
        type: 'url',
        url: s.url,
        channel: s.channel,
        creator: s.creator,
        title: s.title,
        bodyText: s.body_text,
        ogImageUrl: s.og_image_url,
        aiSummary: s.ai_summary,
        scrapCount: s.scrap_count,
        createdAt: s.created_at,
      }));
    }

    // 퀴즈 스크랩
    if (!type || type === 'quiz') {
      const { data: quizScraps } = await this.supabase.db
        .from('user_quiz_scraps')
        .select('id, note, created_at, quiz:quizzes (id, question, choices, correct_answer, brief_explanation, detailed_explanation, category)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      result.quizScraps = (quizScraps || []).map((s: any) => ({
        id: s.id,
        type: 'quiz',
        quizId: s.quiz?.id,
        question: s.quiz?.question,
        choices: s.quiz?.choices,
        correctAnswer: s.quiz?.correct_answer,
        briefExplanation: s.quiz?.brief_explanation,
        detailedExplanation: s.quiz?.detailed_explanation,
        category: s.quiz?.category,
        note: s.note,
        createdAt: s.created_at,
      }));
    }

    // 마이북 하이라이트 스크랩
    if (!type || type === 'highlight') {
      const { data: highlights } = await this.supabase.db
        .from('user_book_highlights')
        .select('id, purchase_id, chapter_index, sentence_text, color, note, created_at, purchase:user_purchases (book_id, source, personalized_chapters, book:money_books (title))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      result.highlightScraps = (highlights || []).map((h: any) => {
        const purchase = h.purchase as any;
        const isScrapBased = purchase?.source === 'scrap';
        const chapters = purchase?.personalized_chapters as any[];
        const bookTitle = isScrapBased
          ? (chapters && chapters.length > 0 ? (chapters[0]?.bookTitle || '나만의 머니북') : '나만의 머니북')
          : (purchase?.book?.title || '');

        return {
          id: h.id,
          type: 'highlight',
          purchaseId: h.purchase_id,
          bookTitle,
          chapterIndex: h.chapter_index,
          sentenceText: h.sentence_text,
          color: h.color,
          note: h.note,
          createdAt: h.created_at,
        };
      });
    }

    result.totalCount = result.urlScraps.length + result.quizScraps.length + result.highlightScraps.length;

    return result;
  }

  // ========== 스크랩 기반 책 생성 ==========

  async generateFromScraps(userId: string) {
    // 1. 스크랩 수 검증
    const { count: urlCount } = await this.supabase.db
      .from('external_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: quizCount } = await this.supabase.db
      .from('user_quiz_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalScraps = (urlCount || 0) + (quizCount || 0);

    if (totalScraps < 100) {
      throw new BadRequestException(
        `스크랩이 ${totalScraps}개입니다. 책 생성에는 최소 100개의 스크랩이 필요합니다.`,
      );
    }

    // 2. 스크랩 데이터 수집
    const { data: urlScraps } = await this.supabase.db
      .from('external_scraps')
      .select('title, ai_summary, channel, creator')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: quizScraps } = await this.supabase.db
      .from('user_quiz_scraps')
      .select('note, quiz:quizzes (question, brief_explanation, detailed_explanation, category)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 3. 유저 재무 프로필
    let profile: any = null;
    try {
      profile = await this.financeService.getFullProfile(userId);
    } catch {
      // 프로필이 없어도 생성 진행
    }

    // 4. 스크랩 스냅샷 저장
    const scrapSnapshot = {
      urlScraps: (urlScraps || []).map((s: any) => ({
        title: s.title,
        aiSummary: s.ai_summary,
        channel: s.channel,
        creator: s.creator,
      })),
      quizScraps: (quizScraps || []).map((s: any) => ({
        question: s.quiz?.question,
        briefExplanation: s.quiz?.brief_explanation,
        detailedExplanation: s.quiz?.detailed_explanation,
        category: s.quiz?.category,
        note: s.note,
      })),
      totalCount: totalScraps,
      generatedAt: new Date().toISOString(),
    };

    // 5. user_purchases 레코드 생성 (상태: generating)
    const { data: purchase, error: insertError } = await this.supabase.db
      .from('user_purchases')
      .insert({
        user_id: userId,
        book_id: null,
        source: 'scrap',
        status: 'generating',
        personalized_chapters: [],
        scrap_snapshot: scrapSnapshot,
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`책 생성 시작 실패: ${insertError.message}`);
    }

    const purchaseId = purchase!.id;

    // 6. 비동기 AI 생성
    this.runAiGeneration(purchaseId, userId, scrapSnapshot, profile).catch(
      (err) => {
        console.error(`[마이북] 스크랩 기반 AI 생성 실패 (purchaseId=${purchaseId}):`, err);
        // 실패 시 상태 업데이트
        this.supabase.db
          .from('user_purchases')
          .update({ status: 'failed' })
          .eq('id', purchaseId)
          .then(() => {});
      },
    );

    return {
      purchaseId,
      status: 'generating',
      message: '스크랩 기반 책 생성이 시작되었습니다. 완료까지 1-2분 소요됩니다.',
    };
  }

  // ========== AI 생성 (비동기) ==========

  private async runAiGeneration(
    purchaseId: string,
    userId: string,
    scrapSnapshot: any,
    profile: any,
  ) {
    console.log(`[마이북] AI 생성 시작 (purchaseId=${purchaseId})`);

    // URL 스크랩 요약
    const urlSummaries = (scrapSnapshot.urlScraps || [])
      .map((s: any, i: number) => `${i + 1}. [${s.channel}] ${s.title}\n   요약: ${s.aiSummary || '없음'}`)
      .join('\n');

    // 퀴즈 스크랩 요약
    const quizSummaries = (scrapSnapshot.quizScraps || [])
      .map((s: any, i: number) => `${i + 1}. [${s.category || '일반'}] ${s.question}\n   설명: ${s.briefExplanation || '없음'}`)
      .join('\n');

    // 유저 프로필 정보
    const profileInfo = profile
      ? `나이: ${profile.age}세, 실수령액: ${profile.monthlyIncome?.toLocaleString()}원, 투자등급: ${profile.grade}, 월 투자액: ${profile.monthlyInvestment?.toLocaleString()}원`
      : '프로필 정보 없음';

    const systemPrompt = `당신은 개인 맞춤 금융 교육 콘텐츠를 만드는 전문가입니다.
유저가 스크랩한 URL 콘텐츠와 퀴즈 데이터를 분석하여, 유저의 관심사와 학습 수준에 맞는 3~5개 챕터로 구성된 개인화 머니북을 작성합니다.

규칙:
- 유저가 실제로 스크랩한 데이터에서 관심사를 파악하세요
- 유저의 재무 상황(프로필)에 맞게 내용을 조정하세요
- 각 챕터는 제목과 본문(content)으로 구성합니다
- 본문은 읽기 쉬운 문장으로 작성하고, 하이라이트할 만한 핵심 문장을 포함하세요
- 확정적 투자 권유는 하지 마세요
- 모든 수치는 유저 프로필 데이터를 직접 사용하세요 (AI가 수치를 만들지 마세요)
- 금융 면책 문구를 마지막 챕터에 포함하세요

JSON 형식으로 응답하세요:
{
  "bookTitle": "전체 책 제목",
  "chapters": [
    {
      "title": "챕터 제목",
      "content": "챕터 본문 (마크다운 가능)"
    }
  ]
}`;

    const userPrompt = `다음은 유저의 스크랩 데이터입니다.

## 유저 프로필
${profileInfo}

## URL 스크랩 (${scrapSnapshot.urlScraps?.length || 0}개)
${urlSummaries || '없음'}

## 퀴즈 스크랩 (${scrapSnapshot.quizScraps?.length || 0}개)
${quizSummaries || '없음'}

위 스크랩 데이터를 분석하여 유저의 관심사를 파악하고, 유저 맞춤형 3~5개 챕터의 머니북을 작성해주세요.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      system: systemPrompt,
    });

    // 응답 파싱
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('AI 응답에서 텍스트를 찾을 수 없습니다.');
    }

    let parsed: any;
    try {
      // JSON 블록 추출 (마크다운 코드블록 포함 가능)
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[마이북] AI 응답 파싱 실패:', textBlock.text);
      throw new Error('AI 응답 파싱 실패');
    }

    const bookTitle = parsed.bookTitle || '나만의 머니북';
    const chapters = (parsed.chapters || []).map((ch: any, index: number) => ({
      bookTitle,
      chapterIndex: index,
      title: ch.title,
      content: ch.content,
    }));

    // DB 업데이트
    const { error: updateError } = await this.supabase.db
      .from('user_purchases')
      .update({
        status: 'completed',
        personalized_chapters: chapters,
        completed_at: new Date().toISOString(),
      })
      .eq('id', purchaseId);

    if (updateError) {
      throw new Error(`책 저장 실패: ${updateError.message}`);
    }

    console.log(`[마이북] AI 생성 완료 (purchaseId=${purchaseId}, chapters=${chapters.length})`);
  }
}
