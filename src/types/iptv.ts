export interface IptvChannel {
  id: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
  epgId?: string; // maps to XMLTV channel id for EPG
}

export interface M3uVodItem {
  id: string;
  name: string;
  url: string;
  group?: string;
  logo?: string;
}

export interface M3uPlaylist {
  channels: IptvChannel[];
  vodItems: M3uVodItem[];
  header?: Record<string, string>;
}
