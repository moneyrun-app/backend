import { MybookService } from './mybook.service.js';

describe('MybookService — 순수 로직', () => {
  let service: MybookService;

  beforeEach(() => {
    service = Object.create(MybookService.prototype);
  });

  describe('detectChannel', () => {
    it('youtube.com → youtube', () => {
      expect(service.detectChannel('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    });

    it('youtu.be → youtube', () => {
      expect(service.detectChannel('https://youtu.be/abc123')).toBe('youtube');
    });

    it('threads.net → threads', () => {
      expect(service.detectChannel('https://www.threads.net/@user/post/abc')).toBe('threads');
    });

    it('기타 URL → etc', () => {
      expect(service.detectChannel('https://blog.naver.com/abc')).toBe('etc');
    });

    it('대소문자 구분 없이 판별', () => {
      expect(service.detectChannel('https://YOUTUBE.COM/watch?v=abc')).toBe('youtube');
      expect(service.detectChannel('https://Threads.NET/@user')).toBe('threads');
    });

    it('빈 문자열 → etc', () => {
      expect(service.detectChannel('')).toBe('etc');
    });
  });
});
