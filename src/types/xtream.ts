export interface XtreamConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface VodMovie {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  added?: string;
  category_id?: string;
  container_extension?: string;
  rating?: string;
  rating_5based?: number;
  [key: string]: unknown;
}

export interface VodSeries {
  num: number;
  name: string;
  series_id: number;
  cover?: string;
  stream_icon?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  release_date?: string;
  rating?: string;
  rating_5based?: number;
  [key: string]: unknown;
}

export interface VodEpisode {
  id: string | number;
  episode_num: number;
  title: string;
  container_extension?: string;
  info?: { movie_image?: string; plot?: string };
  custom_sid?: string | null;
  [key: string]: unknown;
}

export interface SeriesInfo {
  info?: { name?: string; cover?: string; plot?: string };
  episodes: Record<string, VodEpisode[]> | VodEpisode[];
}
