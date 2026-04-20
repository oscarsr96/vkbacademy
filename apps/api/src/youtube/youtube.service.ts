import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationISO8601 } from './duration';
import { YOUTUBE_WHITELIST_CHANNELS } from './youtube-whitelist';
import type { YoutubeCandidate, FindCandidatesOptions } from './dto/youtube-candidate.dto';

const MAX_DURATION_SECONDS = 20 * 60;
const WHITELIST_BOOST = 0.5;
const DEFAULT_LIMIT = 5;
const SEARCH_MAX_RESULTS = 20;

interface SearchListItem {
  id: { videoId: string };
}
interface SearchListResponse {
  items: SearchListItem[];
}

interface VideoListItem {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium?: { url: string } };
  };
  contentDetails: {
    duration: string;
    contentRating?: { ytRating?: string };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
  };
}
interface VideoListResponse {
  items: VideoListItem[];
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('YOUTUBE_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('YOUTUBE_API_KEY no configurada — auto-asignación deshabilitada');
    }
  }

  async findBestVideo(query: string, schoolYearLabel: string): Promise<YoutubeCandidate | null> {
    const [best] = await this.findCandidates(query, schoolYearLabel, { limit: 1 });
    return best ?? null;
  }

  async findCandidates(
    query: string,
    schoolYearLabel: string,
    opts: FindCandidatesOptions = {},
  ): Promise<YoutubeCandidate[]> {
    if (!this.apiKey) return [];

    const fullQuery = `${query} ${schoolYearLabel}`.trim();
    const excludeIds = new Set(opts.excludeIds ?? []);
    const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, SEARCH_MAX_RESULTS);

    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: String(SEARCH_MAX_RESULTS),
      relevanceLanguage: 'es',
      regionCode: 'ES',
      videoDuration: 'any',
      safeSearch: 'strict',
      order: 'relevance',
      key: this.apiKey,
    });
    // Codificamos q con encodeURIComponent para que los espacios sean %20 (no +)
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}` +
      `&q=${encodeURIComponent(fullQuery)}`;

    const search = await this.safeFetchJson<SearchListResponse>(searchUrl);
    if (!search) return [];

    const videoIds = (search.items ?? [])
      .map((it) => it.id.videoId)
      .filter((id) => !excludeIds.has(id));

    if (videoIds.length === 0) return [];

    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'contentDetails,statistics,snippet');
    videosUrl.searchParams.set('id', videoIds.join(','));
    videosUrl.searchParams.set('key', this.apiKey);

    const videos = await this.safeFetchJson<VideoListResponse>(videosUrl.toString());
    if (!videos) return [];

    const candidates: YoutubeCandidate[] = [];
    for (const v of videos.items ?? []) {
      const durationSeconds = parseDurationISO8601(v.contentDetails.duration);
      if (durationSeconds === 0 || durationSeconds > MAX_DURATION_SECONDS) continue;
      if (v.contentDetails.contentRating?.ytRating === 'ytAgeRestricted') continue;

      const viewCount = Number(v.statistics.viewCount);
      const likeCount = Number(v.statistics.likeCount);
      if (!Number.isFinite(viewCount) || !Number.isFinite(likeCount)) continue;
      if (v.statistics.viewCount === undefined || v.statistics.likeCount === undefined) continue;

      const engagementRatio = viewCount > 0 ? likeCount / viewCount : 0;
      const isWhitelisted = YOUTUBE_WHITELIST_CHANNELS.includes(v.snippet.channelId);

      candidates.push({
        youtubeId: v.id,
        title: v.snippet.title,
        channelTitle: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        durationSeconds,
        viewCount,
        likeCount,
        engagementRatio,
        isWhitelisted,
        publishedAt: v.snippet.publishedAt,
        thumbnailUrl: v.snippet.thumbnails.medium?.url ?? '',
      });
    }

    candidates.sort((a, b) => {
      const scoreA = a.engagementRatio + (a.isWhitelisted ? WHITELIST_BOOST : 0);
      const scoreB = b.engagementRatio + (b.isWhitelisted ? WHITELIST_BOOST : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.viewCount - a.viewCount;
    });

    return candidates.slice(0, limit);
  }

  private async safeFetchJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`[youtube] fetch ${res.status} ${url.split('?')[0]}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`[youtube] fetch error: ${(err as Error).message}`);
      return null;
    }
  }
}
