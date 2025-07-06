export interface VideoResult {
  title: string;
  artist: string;
  youtubeUrl: string;
  thumbnailUrl: string;
}

export interface VideoInfo {
  title: string;
  filename: string;
  duration: string;
  thumbnail: string;
  availableFormats: AvailableFormat[];
}

export interface AvailableFormat {
  itag: number;
  quality: string;
  qualityLabel?: string;
  container: string;
  hasVideo: boolean;
  hasAudio: boolean;
  audioCodec?: string;
  videoCodec?: string;
  filesize?: number;
  audioBitrate?: number;
}

export interface DownloadOptions {
  format: 'mp3' | 'mp4';
  quality: string;
  itag?: number;
}

export interface ConvertRequest {
  url: string;
  format: 'mp3' | 'mp4';
  quality: string;
  itag?: number;
}
