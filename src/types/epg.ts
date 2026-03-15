export interface EpgProgram {
  id: string;
  channelId: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  category?: string;
  icon?: string;
}

export interface EpgChannel {
  id: string;
  displayName: string;
  icon?: string;
  programs: EpgProgram[];
}

export interface EpgData {
  channels: EpgChannel[];
  source?: string;
}
