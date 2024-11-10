import { GlossaryConfig, GlossaryWorker } from '@/model/IGlossary';
import { Word } from './model/Word';
import { NER_TYPES, NERTYPE } from './model/NerType';
import { LogHelper } from './helper/LogHelper';
import { TextHelper } from './helper/TextHelper';
import { LANGUAGE } from './GlossaryGenerator';

export class GlossaryNerProcessor {
  private config: GlossaryWorker;
  private nermode: string;
  private logger: LogHelper;
  private blacklist: string[] = [];

  constructor(config: GlossaryWorker, logger: LogHelper) {
    this.config = config;
    this.nermode = this.config.ner;
    this.logger = logger;
  }

  loadBlackList(blacklist: string[]) {
    this.blacklist = blacklist;
  }

  async generateWord(content: string): Promise<Word[]> {
    if (this.nermode == 'traditional') {
      return await this.generateGlossaryTraditional(
        content,
        this.config.countthreshold,
      );
    }
    return [];
  }

  async generateGlossaryTraditional(
    content: string,
    threshold: number,
  ): Promise<Word[]> {
    const regexp = /[\u30A0-\u30FF]{2,}/g;
    const matches = content.matchAll(regexp);
    const wordMap: Map<string, number> = new Map();
    const words: Word[] = [];

    for (const match of matches) {
      const w = match[0];
      wordMap.set(w, (wordMap.get(w) || 0) + 1);
    }

    wordMap.forEach((count, surface) => {
      if (count < threshold) return;
      //片假名NER無法做置信度過濾，無條件通過
      const word = new Word(surface, NERTYPE.UNKNOWN, count, 0.9);

      words.push(word);
    });

    return words.sort((a, b) => b.count - a.count);
  }

  async generateGlossaryLocal(): Promise<Word[]> {
    return [];
  }

  async packNERResultToWords(
    surface: string,
    context: string,
    score: number,
    nerType: string,
    language: string,
    uniqueWords: string[],
  ): Promise<Word[]> {
    let words: Word[] = [];
    let surfaces: string[] = [];

    if (nerType != NERTYPE.PER) {
      surfaces.push(surface);
    } else {
      surfaces = surface.split(TextHelper.RE_SPLIT_BY_PUNCTUATION);
    }

    for (surface of surfaces) {
      if (!NER_TYPES.includes(nerType)) continue;
      if (language === LANGUAGE.ZH) {
        surface = TextHelper.stripNotCJK(surface);
        if (!TextHelper.isValidCJKWord(surface, this.blacklist)) {
          continue;
        }
      }
      if (language === LANGUAGE.EN) {
        surface = TextHelper.stripNotLatin(surface);
        if (
          !TextHelper.isValidEnglishWord(
            surface,
            this.blacklist,
            nerType,
            uniqueWords,
          )
        )
          continue;
      }
      if (language === LANGUAGE.JP) {
        surface = TextHelper.stripNotJapanese(surface).replace(/の$/, '');
        if (!TextHelper.isValidJapaneseWord(surface, this.blacklist)) continue;
      }
      if (language === LANGUAGE.KR) {
        surface = TextHelper.stripNotKorean(surface);
        if (!TextHelper.isValidKoreanWord(surface, this.blacklist)) continue;
      }
      const word = new Word();
      word.surface = surface;
      word.count = 1;
      word.score = score;
      word.context.push(context);
      word.nerType = nerType;

      words.push(word);
    }

    return words;
  }
}
