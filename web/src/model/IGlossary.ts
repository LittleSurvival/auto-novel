import { translate } from '../domain/translate/Translate';
export interface GlossaryConfig {
  mode: 'traditional' | 'ai';
  traditionalthreshold: number;
  currentworker: number;
  workers: GlossaryWorker[];
  history: VolumeHistory[];
}

export type WGlossary = {
  [jp: string]: { zh?: string; info?: string; count: number };
};

export interface GlossaryWorker {
  type: 'local' | 'api'; //localhost 或使用在線大模型
  ner: 'local' | 'katakana' | 'api'; //local 使用本地ner lm | katakana 使用 片假名分詞 | api目前無法實現(due to promote engineering)
  apikey: string; //在線大模型的apikey
  baseurl: string; //url
  modelname: string; //在線大模型的modelname
  countthreshold: number; //詞頻篩選
  timeout: number; //超時限制
  requestfrequency: number; //網絡請求頻率(Chrome對本地有6次的限制)
  translatesurface: boolean; //是否翻譯術語
  translatecontentper: boolean; //是否翻譯人名實體的上下文
  translatecontentother: boolean; //是否翻譯其他實體上下文
}

export interface VolumeHistory {
  source: 'tmp' | 'local';
  filename: string;
  katakanas: WGlossary;
  date: number;
}
