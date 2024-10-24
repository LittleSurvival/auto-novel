import { GlossaryConfig, GlossaryWorker } from '@/model/IGlossary';
import { Word } from './model/Word';
import { NERTYPE } from './model/NerType';
import { LogHelper } from './helper/LogHelper';

export class GlossaryNerProcessor {
  private config: GlossaryWorker;
  private mode: string;
  private logger: LogHelper;
  private blacklist: string[] = [];

  constructor(config: GlossaryWorker, logger: LogHelper) {
    this.config = config;
    this.mode = this.config.ner;
    this.logger = logger;
  }

  loadBlackList(blacklist: string[]) {
    this.blacklist = blacklist;
  }

  async generateWord(content: string): Promise<Word[]> {
    if (this.mode == 'traditional') {
      await this.generateGlossaryTraditional(content);
    }
    return [];
  }

  async generateGlossaryTraditional(content: string): Promise<Word[]> {
    const regexp = /[\u30A0-\u30FF]{2,}/g;
    const matches = content.matchAll(regexp);
    const wordMap: Map<string, number> = new Map();
    const words: Word[] = [];

    for (const match of matches) {
      const w = match[0];
      wordMap.set(w, (wordMap.get(w) || 0) + 1);
    }

    wordMap.forEach((count, surface) => {
      if (count < this.config.countthreshold) return;
      //片假名NER無法做置信度過濾，無條件通過
      const word = new Word(surface, NERTYPE.UNKNOWN, count, 0.9);

      words.push(word);
    });

    return words.sort((a, b) => b.count - a.count);
  }
}
