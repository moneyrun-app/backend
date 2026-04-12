import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class MoneyBookService {
  private anthropic: Anthropic;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ========== 유저 API ==========

  /** 출판된 머니북 목록 조회 (isPurchased 포함) */
  async listBooks(userId: string, category?: string) {
    let query = this.supabase.db
      .from('money_books')
      .select('id, title, description, category, cover_image_url, required_fields, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: books, error } = await query;

    if (error) {
      throw new InternalServerErrorException(`머니북 목록 조회 실패: ${error.message}`);
    }

    // 유저의 구매 목록 조회
    const { data: purchases } = await this.supabase.db
      .from('user_purchases')
      .select('book_id')
      .eq('user_id', userId);

    const purchasedBookIds = new Set((purchases || []).map((p: any) => p.book_id));

    return {
      items: (books || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        category: b.category,
        coverImageUrl: b.cover_image_url,
        requiredFields: b.required_fields,
        isPurchased: purchasedBookIds.has(b.id),
        createdAt: b.created_at,
      })),
    };
  }

  /** 머니북 상세 조회 (챕터 미리보기 + 구매 여부) */
  async getBookDetail(userId: string, bookId: string) {
    const { data: book, error: bookError } = await this.supabase.db
      .from('money_books')
      .select('*')
      .eq('id', bookId)
      .eq('is_published', true)
      .single();

    if (bookError || !book) {
      throw new NotFoundException('머니북을 찾을 수 없습니다.');
    }

    // 챕터 목록 (prompt_template의 처음 200자만 미리보기)
    const { data: chapters } = await this.supabase.db
      .from('money_book_chapters')
      .select('id, chapter_order, title, prompt_template')
      .eq('book_id', bookId)
      .order('chapter_order', { ascending: true });

    // 구매 여부 확인
    const { data: purchase } = await this.supabase.db
      .from('user_purchases')
      .select('id, status, personalized_chapters, completed_at')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single();

    return {
      id: book.id,
      title: book.title,
      description: book.description,
      category: book.category,
      coverImageUrl: book.cover_image_url,
      requiredFields: book.required_fields,
      chapters: (chapters || []).map((c: any) => ({
        id: c.id,
        chapterOrder: c.chapter_order,
        title: c.title,
        preview: c.prompt_template
          ? c.prompt_template.substring(0, 200)
          : '',
      })),
      isPurchased: !!purchase,
      purchaseId: purchase?.id || null,
      purchaseStatus: purchase?.status || null,
      personalizedChapters: purchase?.personalized_chapters || null,
      completedAt: purchase?.completed_at || null,
      createdAt: book.created_at,
    };
  }

  /** 머니북 구매 + AI 생성 시작 */
  async purchaseBook(userId: string, bookId: string, extraData: Record<string, any>) {
    // 책 존재 확인
    const { data: book, error: bookError } = await this.supabase.db
      .from('money_books')
      .select('id, title')
      .eq('id', bookId)
      .eq('is_published', true)
      .single();

    if (bookError || !book) {
      throw new NotFoundException('머니북을 찾을 수 없습니다.');
    }

    // 중복 구매 방지
    const { data: existing } = await this.supabase.db
      .from('user_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single();

    if (existing) {
      throw new BadRequestException('이미 구매한 머니북입니다.');
    }

    // 유저 스크랩 스냅샷 저장
    const { data: scraps } = await this.supabase.db
      .from('external_scraps')
      .select('url, channel, title, ai_summary')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 구매 레코드 생성
    const { data: purchase, error: purchaseError } = await this.supabase.db
      .from('user_purchases')
      .insert({
        user_id: userId,
        book_id: bookId,
        source: 'store',
        extra_onboarding_data: extraData || {},
        status: 'generating',
        scrap_snapshot: scraps || [],
      })
      .select('id')
      .single();

    if (purchaseError || !purchase) {
      throw new InternalServerErrorException(`구매 생성 실패: ${purchaseError?.message}`);
    }

    // 챕터 수 조회 (예상 시간 계산용)
    const { count } = await this.supabase.db
      .from('money_book_chapters')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', bookId);

    const chapterCount = count || 1;
    const estimatedSeconds = chapterCount * 15;

    // 비동기 AI 생성 시작 (await 하지 않음)
    this.generatePersonalizedBook(purchase.id, userId, bookId, extraData).catch((err) => {
      console.error(`[머니북] AI 생성 실패 (purchaseId=${purchase.id}):`, err);
    });

    return {
      purchaseId: purchase.id,
      status: 'generating',
      estimatedSeconds,
    };
  }

  /** 비동기 AI 챕터 생성 */
  private async generatePersonalizedBook(
    purchaseId: string,
    userId: string,
    bookId: string,
    extraData: Record<string, any>,
  ) {
    console.log(`[머니북] AI 생성 시작 (purchaseId=${purchaseId})`);

    try {
      // 1. 챕터 템플릿 조회
      const { data: chapters, error: chaptersError } = await this.supabase.db
        .from('money_book_chapters')
        .select('id, chapter_order, title, prompt_template')
        .eq('book_id', bookId)
        .order('chapter_order', { ascending: true });

      if (chaptersError || !chapters || chapters.length === 0) {
        throw new Error('챕터를 찾을 수 없습니다.');
      }

      // 2. 유저 재무 프로필 조회
      let profile: Record<string, any> = {};
      try {
        profile = await this.financeService.getFullProfile(userId);
      } catch {
        console.warn(`[머니북] 재무 프로필 없음 (userId=${userId}), extraData만 사용`);
      }

      // 3. 플레이스홀더 데이터 구성
      const placeholderData: Record<string, any> = {
        // 재무 프로필 데이터
        nickname: profile.nickname || '유저',
        age: profile.age || '',
        monthlyIncome: profile.monthlyIncome || '',
        monthlyFixedCost: profile.monthlyFixedCost || '',
        monthlyVariableCost: profile.monthlyVariableCost || '',
        monthlyInvestment: profile.monthlyInvestment || '',
        monthlyExpense: profile.monthlyExpense || '',
        surplus: profile.surplus || '',
        grade: profile.grade || '',
        retirementAge: profile.retirementAge || '',
        pensionStartAge: profile.pensionStartAge || '',
        investmentPeriod: profile.investmentPeriod || '',
        vestingPeriod: profile.vestingPeriod || '',
        variableCostMonthly: profile.variableCost?.monthly || '',
        variableCostWeekly: profile.variableCost?.weekly || '',
        variableCostDaily: profile.variableCost?.daily || '',
        // extraData 오버라이드
        ...extraData,
      };

      // 4. 각 챕터별 AI 생성
      const personalizedChapters: any[] = [];

      for (const chapter of chapters) {
        console.log(`[머니북] 챕터 ${chapter.chapter_order} 생성 중: ${chapter.title}`);

        const filledPrompt = this.replacePlaceholders(chapter.prompt_template, placeholderData);

        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: filledPrompt }],
        });

        const content =
          response.content[0].type === 'text' ? response.content[0].text : '';

        personalizedChapters.push({
          chapterId: chapter.id,
          chapterOrder: chapter.chapter_order,
          title: chapter.title,
          content,
        });
      }

      // 5. 결과 저장 + 상태 업데이트
      const now = new Date().toISOString();
      const { error: updateError } = await this.supabase.db
        .from('user_purchases')
        .update({
          personalized_chapters: personalizedChapters,
          status: 'completed',
          completed_at: now,
        })
        .eq('id', purchaseId);

      if (updateError) {
        throw new Error(`구매 업데이트 실패: ${updateError.message}`);
      }

      console.log(`[머니북] AI 생성 완료 (purchaseId=${purchaseId}, ${personalizedChapters.length}챕터)`);
    } catch (err) {
      // 실패 시 상태를 'failed'로 업데이트
      await this.supabase.db
        .from('user_purchases')
        .update({ status: 'failed' })
        .eq('id', purchaseId);

      throw err;
    }
  }

  /** {{key}} 패턴을 실제 값으로 치환 */
  private replacePlaceholders(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key];
      if (value === undefined || value === null || value === '') {
        return `{{${key}}}`;
      }
      return String(value);
    });
  }

  // ========== 관리자 API ==========

  /** 머니북 생성 */
  async createBook(dto: {
    title: string;
    description?: string;
    category?: string;
    coverImageUrl?: string;
    requiredFields?: Record<string, any>;
    isPublished?: boolean;
  }) {
    const { data, error } = await this.supabase.db
      .from('money_books')
      .insert({
        title: dto.title,
        description: dto.description || null,
        category: dto.category || null,
        cover_image_url: dto.coverImageUrl || null,
        required_fields: dto.requiredFields || null,
        is_published: dto.isPublished ?? false,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`머니북 생성 실패: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      coverImageUrl: data.cover_image_url,
      requiredFields: data.required_fields,
      isPublished: data.is_published,
      createdAt: data.created_at,
    };
  }

  /** 머니북 수정 */
  async updateBook(bookId: string, dto: {
    title?: string;
    description?: string;
    category?: string;
    coverImageUrl?: string;
    requiredFields?: Record<string, any>;
    isPublished?: boolean;
  }) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.coverImageUrl !== undefined) updateData.cover_image_url = dto.coverImageUrl;
    if (dto.requiredFields !== undefined) updateData.required_fields = dto.requiredFields;
    if (dto.isPublished !== undefined) updateData.is_published = dto.isPublished;

    const { data, error } = await this.supabase.db
      .from('money_books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('머니북을 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      coverImageUrl: data.cover_image_url,
      requiredFields: data.required_fields,
      isPublished: data.is_published,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /** 머니북 삭제 */
  async deleteBook(bookId: string) {
    // 연관 챕터 먼저 삭제
    await this.supabase.db
      .from('money_book_chapters')
      .delete()
      .eq('book_id', bookId);

    const { error } = await this.supabase.db
      .from('money_books')
      .delete()
      .eq('id', bookId);

    if (error) {
      throw new InternalServerErrorException(`머니북 삭제 실패: ${error.message}`);
    }

    return { message: '삭제되었습니다.' };
  }

  /** 챕터 생성 */
  async createChapter(bookId: string, dto: {
    title: string;
    promptTemplate: string;
    chapterOrder?: number;
  }) {
    // 책 존재 확인
    const { data: book } = await this.supabase.db
      .from('money_books')
      .select('id')
      .eq('id', bookId)
      .single();

    if (!book) {
      throw new NotFoundException('머니북을 찾을 수 없습니다.');
    }

    // chapterOrder가 없으면 자동 계산
    let chapterOrder = dto.chapterOrder;
    if (chapterOrder === undefined) {
      const { data: lastChapter } = await this.supabase.db
        .from('money_book_chapters')
        .select('chapter_order')
        .eq('book_id', bookId)
        .order('chapter_order', { ascending: false })
        .limit(1)
        .single();

      chapterOrder = (lastChapter?.chapter_order || 0) + 1;
    }

    const { data, error } = await this.supabase.db
      .from('money_book_chapters')
      .insert({
        book_id: bookId,
        chapter_order: chapterOrder,
        title: dto.title,
        prompt_template: dto.promptTemplate,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`챕터 생성 실패: ${error.message}`);
    }

    return {
      id: data.id,
      bookId: data.book_id,
      chapterOrder: data.chapter_order,
      title: data.title,
      promptTemplate: data.prompt_template,
      createdAt: data.created_at,
    };
  }

  /** 챕터 수정 */
  async updateChapter(bookId: string, chapterId: string, dto: {
    title?: string;
    promptTemplate?: string;
    chapterOrder?: number;
  }) {
    const updateData: Record<string, any> = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.promptTemplate !== undefined) updateData.prompt_template = dto.promptTemplate;
    if (dto.chapterOrder !== undefined) updateData.chapter_order = dto.chapterOrder;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('수정할 필드가 없습니다.');
    }

    const { data, error } = await this.supabase.db
      .from('money_book_chapters')
      .update(updateData)
      .eq('id', chapterId)
      .eq('book_id', bookId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('챕터를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      bookId: data.book_id,
      chapterOrder: data.chapter_order,
      title: data.title,
      promptTemplate: data.prompt_template,
      createdAt: data.created_at,
    };
  }
}
