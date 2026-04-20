/**
 * Datos que devolvemos al cliente por cada candidato de YouTube.
 * Todos los campos son primitivos para facilitar serialización JSON.
 */
export interface YoutubeCandidate {
  youtubeId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  engagementRatio: number; // likeCount / viewCount (0 si viewCount === 0)
  isWhitelisted: boolean;
  publishedAt: string; // ISO 8601
  thumbnailUrl: string; // snippet.thumbnails.medium.url (320x180)
}

export interface FindCandidatesOptions {
  limit?: number; // default 5, max 20
  excludeIds?: string[];
}
