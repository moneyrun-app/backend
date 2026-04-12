/**
 * YouTube 자막 추출 유틸 (외부 패키지 없이 직접 구현)
 * YouTube InnerTube API를 사용하여 자막 트랙을 가져옴
 */

interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const VIDEO_ID_REGEX =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

export async function fetchYoutubeTranscript(
  urlOrId: string,
  lang = 'ko',
): Promise<TranscriptItem[]> {
  const videoId = extractVideoId(urlOrId);

  // 1차: InnerTube API로 시도
  const tracks = await fetchCaptionTracks(videoId);
  if (!tracks || tracks.length === 0) {
    throw new Error('자막을 찾을 수 없습니다.');
  }

  // 요청 언어 우선, 없으면 첫 번째 트랙
  const track =
    tracks.find((t: any) => t.languageCode === lang) || tracks[0];

  if (!track?.baseUrl) {
    throw new Error('자막 URL을 찾을 수 없습니다.');
  }

  // 자막 XML 가져오기
  const res = await fetch(track.baseUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`자막 다운로드 실패: ${res.status}`);
  }

  const xml = await res.text();
  return parseTranscriptXml(xml);
}

async function fetchCaptionTracks(videoId: string): Promise<any[]> {
  // 방법 1: 웹 페이지에서 추출
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) throw new Error('페이지 로드 실패');

    const html = await res.text();

    // ytInitialPlayerResponse에서 자막 트랙 추출
    const match = html.match(
      /ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|<\/script)/,
    );
    if (!match) throw new Error('플레이어 응답 없음');

    const playerResponse = JSON.parse(match[1]);
    const captionTracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (Array.isArray(captionTracks) && captionTracks.length > 0) {
      return captionTracks;
    }

    throw new Error('자막 트랙 없음');
  } catch {
    return [];
  }
}

function parseTranscriptXml(xml: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];

  // <text start="0.0" dur="2.5">내용</text> 형식
  const textRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(xml)) !== null) {
    const text = decodeEntities(match[3]).trim();
    if (text) {
      items.push({
        text,
        offset: parseFloat(match[1]) || 0,
        duration: parseFloat(match[2]) || 0,
      });
    }
  }

  return items;
}

function decodeEntities(str: string): string {
  return str
    .replace(/<[^>]+>/g, '') // HTML 태그 제거
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

function extractVideoId(urlOrId: string): string {
  if (urlOrId.length === 11 && !urlOrId.includes('/')) return urlOrId;
  const match = urlOrId.match(VIDEO_ID_REGEX);
  if (match && match[1]) return match[1];
  throw new Error(`유효하지 않은 YouTube URL: ${urlOrId}`);
}
