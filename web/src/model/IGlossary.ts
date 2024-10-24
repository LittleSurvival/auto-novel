import { translate } from '../domain/translate/Translate';
export interface GlossaryConfig {
  mode: 'traditional' | 'ai';
  currentworker: number;
  workers: GlossaryWorker[];
  history: VolumeHistory[];
}

export type WGlossary = {
  [jp: string]: { zh?: string; info?: string; count: number };
};

export interface GlossaryWorker {
  type: 'local' | 'api'; //localhost 或使用在線大模型
  ner: 'local' | 'traditional' | 'api'; //local 使用本地ner lm | traditional 使用 片假名分詞 | api目前無法實現(due to promote engineering)
  apikey: 'sk-no-key-required'; //在線大模型的apikey
  baseurl: 'http://localhost:8080/v1'; //url
  modelname: 'glm-4-9b-chat'; //在線大模型的modelname
  countthreshold: 3; //詞頻篩選
  timeout: 180; //超時限制
  requestfrequency: 4; //網絡請求頻率(Chrome對本地有6次的限制)
  translatesurface: true; //是否翻譯術語
  translatecontentper: true; //是否翻譯人名實體的上下文
  translatecontentother: true; //是否翻譯其他實體上下文
}

export interface VolumeHistory {
  source: 'tmp' | 'local';
  filename: string;
  katakanas: WGlossary;
  date: number;
}
