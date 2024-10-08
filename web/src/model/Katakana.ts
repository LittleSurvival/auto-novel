export interface KataKanaConfig {
  mode: 'traditional' | 'ai';
  max_workers: 4;
  request_timeout: 120;
  translate_surface_mode: 1;
  translate_context_mode: 1;
  history: VolumeHistory[];
}

export type KataKana = {
  [jp: string]: { zh?: string; info?: string; count: number };
};

export interface VolumeHistory {
  source: 'tmp' | 'local';
  filename: string;
  katakanas: KataKana;
  date: number;
}
