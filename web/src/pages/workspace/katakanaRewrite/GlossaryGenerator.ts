import { GlossaryWorker, WGlossary } from '../../../model/IGlossary';
import { LogHelper } from './helper/LogHelper';
import { Word } from './model/Word';
import { TextHelper } from './helper/TextHelper';
import { NERTYPE, NERTYPECHINESE } from './model/NerType';
import { GlosssaryContextProcessor, TaskType } from './GlossaryContextProcess';
import { GlossaryNerProcessor } from './GlossaryNerProcessor';

export enum LANGUAGE {
  ZH = 'ZH',
  EN = 'EN',
  JP = 'JP',
  KR = 'KR',
}

const LANGUAGETEXT = {
  ZH: '中文',
  EN: '英文',
  JP: '日文',
  KR: '韓文',
};

export class GlossaryGenerator {
  private logger: LogHelper;
  private config: GlossaryWorker;
  private contextProcessor: GlosssaryContextProcessor;
  private nerProcessor: GlossaryNerProcessor;
  private blacklist: string[] = [];

  constructor(config: GlossaryWorker, logger: LogHelper, blacklist: string[]) {
    this.logger = logger;
    this.logger.clearLogs();
    this.config = config;
    this.blacklist = blacklist;

    this.contextProcessor = new GlosssaryContextProcessor(config, logger);
    this.nerProcessor = new GlossaryNerProcessor(config, logger);

    this.contextProcessor.loadBlackList(this.blacklist);
    this.nerProcessor.loadBlackList(this.blacklist);
  }

  loadKataKanas = async (
    content: string,
    threshold: number,
  ): Promise<WGlossary> => {
    this.logger.info('執行 查找片假名');
    const words = await this.nerProcessor.generateGlossaryTraditional(
      content,
      threshold,
    );
    return this.wordsToGlossary(words);
  };

  loadGlossary = async (content: string): Promise<WGlossary> => {
    let words: Word[] = [];
    const [contentLines, names] = await this.processText(content);

    this.logger.info('進行文本語言偵測');
    const [language, propotion] = await this.detectLanguage(contentLines);

    if (language == undefined) {
      this.logger.error('偵測文本為未知語言 停止偵測');
    } else {
      this.logger.info(
        `偵測文本為 ${LANGUAGETEXT[language]}, 總佔比 ${propotion}%`,
      );
      if (propotion < 75) {
        this.logger.warning(
          '這可能是多語言文本，目前僅支持單語言文本識別，以占比最高者為準',
        );
      }
    }

    this.logger.info('查找名詞實體');
    words = await this.nerProcessor.generateWord(contentLines.join('\n'));

    //Debug mode for threshold(Deleted)
    this.logger.info('消去重複字和計算詞彙出現次數');
    if (this.config.ner != 'traditional') {
      words = await this.mergeAndCount(words, contentLines, language);
    } else this.logger.info(`NER分詞模式為傳統 查找時已完成此步驟`);

    this.logger.info('執行查找上下文');
    this.logger.startProgress('查找上下文', words.length);

    let completed = 0;
    await Promise.all(
      words.map(async (word) => {
        word.context = await word.searchContext(contentLines, words);
        this.logger.updateProgress(++completed, words.length);
      }),
    );

    this.logger.finishProgress();

    //使用上下文還原詞根，僅對日文使用
    if (language == LANGUAGE.JP) {
      this.logger.info('執行還原詞根');
      words = this.lemmatizeWordsByMorphology(words);
      words = this.removeWordsByNerType(words, NERTYPE.EMPTY);
      words = await this.mergeAndCount(words, contentLines, language);
      this.logger.info('還原詞根 已完成');

      this.logger.startProgress('更新上下文', words.length);
      let completed = 0;
      await Promise.all(
        words.map(async (word) => {
          word.context = await word.searchContext(contentLines, words);
          this.logger.updateProgress(++completed, words.length);
        }),
      );
      this.logger.finishProgress();
    }

    //詞頻篩選
    this.logger.info(
      `執行詞頻篩選 當前設置詞頻為 出現${this.config.countthreshold}次`,
    );
    const [filteredWords, deletedCount] = this.removeWordsByCountThresHold(
      words,
      this.config.countthreshold,
    );

    words = filteredWords;
    this.logger.info(
      `已刪除 ${deletedCount}項詞頻低於${this.config.countthreshold}次的術語`,
    );
    this.logger.info(`有效詞條 共${words.length}項`);
    this.logger.info('詞頻篩選 已完成');

    //語意分析
    this.logger.info('執行 語意分析');
    let wordsPerson = this.getWordsByNerType(words, NERTYPE.PER);
    wordsPerson = await this.contextProcessor.doTask(
      wordsPerson,
      TaskType.SummarizeContext,
    );
    wordsPerson = this.removeWordsByNerType(wordsPerson, NERTYPE.EMPTY);
    words = this.replaceWordsByNerType(words, wordsPerson, NERTYPE.PER);

    //執行重複性校驗
    this.logger.info('執行 重複性校驗');
    words = this.validateWordsByDuplication(words);
    words = this.removeWordsByNerType(words, NERTYPE.EMPTY);

    console.log(words);

    //詞語翻譯
    if (this.config.translatesurface) {
      this.logger.info('執行 詞語翻譯');
      if (language == LANGUAGE.ZH) {
        this.logger.info('文本為中文 跳過此步驟');
      } else {
        words = await this.contextProcessor.doTask(
          words,
          TaskType.TranslateSurface,
        );
      }
    }

    //上下文翻譯
    if (this.config.translatesurface) {
      this.logger.info('執行 上下文翻譯');
      if (language == LANGUAGE.ZH) this.logger.info('文本為中文 跳過此步驟');
      else {
        for (const [_, v] of Object.entries(NERTYPE)) {
          if (
            (v === NERTYPE.PER && this.config.translatecontentper) ||
            (v !== NERTYPE.PER && this.config.translatecontentother)
          ) {
            this.logger.info(`執行 上下文翻譯 ${NERTYPECHINESE[v]}部分`);
            let wordType = this.getWordsByNerType(words, v);
            wordType = await this.contextProcessor.doTask(
              words,
              TaskType.TranslateContext,
            );
            words = this.replaceWordsByNerType(words, wordType, v);
          }
        }
      }
    }

    return this.wordsToGlossary(words);
  };

  async processText(content: string): Promise<[string[], string[]]> {
    const inputlinesFilters: string[] = [];
    const nameFromJson: string[] = [];
    const lines = content.split(/\r?\n/);
    const jsonContent = this.readJsonContent(content);
    nameFromJson.push(...jsonContent);

    lines.forEach((line) => {
      // 【\N[123]】 这种形式是代指角色名字的变量
      // 直接抹掉就没办法判断角色了，只把 \N 部分抹掉，保留 ID 部分
      line = line.trim().replace('\\N', '');

      // 放大或者缩小字体的代码，干掉
      // \{\{ゴゴゴゴゴゴゴゴゴッ・・・\r\n（大地の揺れる音）
      line = line.replace(/(\\\{)|(\\\})/g, '');

      // /C[4] 这种形式的代码，干掉
      line = line.replace(/\/[A-Z]{1,5}\[\d+\]/gi, '');

      // \FS[29] 这种形式的代码，干掉
      line = line.replace(/\\[A-Z]{1,5}\[\d+\]/gi, '');

      // \nw[隊員Ｃ] 这种形式的代码，干掉 [ 前的部分
      line = line.replace(/\\[A-Z]{1,5}\[/gi, '[');

      // 由于上面的代码移除，可能会产生空人名框的情况，干掉
      line = line.replace('【】', '');

      // 干掉除了空格以外的行内空白符（包括换行符、制表符、回车符、换页符等）
      line = line.replace(/[^\S ]+/g, '');

      // 合并连续的空格为一个空格
      line = line.replace(/ +/g, ' ');

      inputlinesFilters.push(line.trim());
    });
    return [inputlinesFilters, nameFromJson];
  }

  async detectLanguage(lines: string[]): Promise<[LANGUAGE, number]> {
    const languageCounts: Record<LANGUAGE, number> = {
      [LANGUAGE.ZH]: 0,
      [LANGUAGE.EN]: 0,
      [LANGUAGE.JP]: 0,
      [LANGUAGE.KR]: 0,
    };

    for (const line of lines) {
      if (line.trim() === '') continue; // 跳过空行

      let zhCount = 0;
      let enCount = 0;
      let jpCount = 0;
      let krCount = 0;
      let totalCount = 0;

      for (const char of line) {
        if (TextHelper.is_japanese(char)) {
          jpCount++;
        } else if (TextHelper.is_korean(char)) {
          krCount++;
        } else if (TextHelper.is_cjk(char)) {
          zhCount++;
        } else if (TextHelper.is_latin(char)) {
          enCount++;
        }
        totalCount++;
      }

      if (totalCount === 0) continue; // 如果行中没有可识别的字符，跳过

      // 计算各语言的比例
      const zhRatio = zhCount / totalCount;
      const enRatio = enCount / totalCount;
      const jpRatio = jpCount / totalCount;
      const krRatio = krCount / totalCount;

      // 找出比例最高的语言
      const maxRatio = Math.max(zhRatio, enRatio, jpRatio, krRatio);
      if (maxRatio === jpRatio) {
        languageCounts[LANGUAGE.JP]++;
      } else if (maxRatio === krRatio) {
        languageCounts[LANGUAGE.KR]++;
      } else if (maxRatio === zhRatio) {
        languageCounts[LANGUAGE.ZH]++;
      } else if (maxRatio === enRatio) {
        languageCounts[LANGUAGE.EN]++;
      }
    }

    // 找出行数最多的语言
    let detectedLanguage: LANGUAGE | undefined = undefined; // 默认语言
    detectedLanguage = (Object.keys(languageCounts) as LANGUAGE[]).reduce(
      (a, b) => (languageCounts[b] > languageCounts[a] ? b : a),
    );

    const totalDetected = Object.values(languageCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const proportion =
      totalDetected > 0
        ? (languageCounts[detectedLanguage] / totalDetected) * 100
        : 0;

    return [detectedLanguage, proportion];
  }

  readJsonContent(jsonString: string): string[] {
    const lines: string[] = [];
    const names: string[] = [];

    try {
      // 尝试解析JSON字符串
      const data: any = JSON.parse(jsonString);

      // 检查是否为MToolData格式（对象且所有值都是字符串）
      const isMToolData =
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        Object.values(data).every((value) => typeof value === 'string');

      // 检查是否为SExtractorData格式（数组且每个元素具有name和message字段）
      const isSExtractorData =
        Array.isArray(data) &&
        data.every(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            (typeof item.name === 'undefined' ||
              typeof item.name === 'string') &&
            (typeof item.message === 'undefined' ||
              typeof item.message === 'string'),
        );

      if (isMToolData) {
        // 处理MTool导出的文本
        // 示例:
        // {
        //   "「お前かよ。開けて。着替えなきゃ」" : "「お前かよ。開けて。着替えなきゃ」"
        // }
        for (const [key, value] of Object.entries(data)) {
          if (typeof key === 'string' && typeof value === 'string') {
            lines.push(key);
          }
        }
      } else if (isSExtractorData) {
        // 处理SExtractor导出的带name字段JSON数据
        // 示例:
        // [{
        //   "name": "少年",
        //   "message": "「お前かよ。開けて。着替えなきゃ」"
        // }]
        for (const item of data) {
          const name = item.name?.trim();
          if (typeof name === 'string' && name !== '') {
            names.push(name);
          }

          const message = item.message?.trim();
          if (typeof message === 'string' && message !== '') {
            lines.push(message);
          }
        }
      }
    } catch (e) {
      //不是Json檔案或解析錯誤，跳過
    }
    return names;
  }

  async mergeAndCount(
    words: Word[],
    contentLines: string[],
    language: LANGUAGE,
  ): Promise<Word[]> {
    const uniqueKeys = words
      .map((word) => `${word.surface}_${word.ner_type}`)
      .filter((value, index, self) => self.indexOf(value) === index); //只有文字和类型都一样才视为相同条目，避免跨类词条目合并
    //置信度篩選，尚無參考和準確測試數據，暫定0.8
    const threshold: { [key in LANGUAGE]: [number, number] } = {
      [LANGUAGE.ZH]: [0.8, 0.8],
      [LANGUAGE.EN]: [0.8, 0.8],
      [LANGUAGE.JP]: [0.8, 0.8],
      [LANGUAGE.KR]: [0.8, 0.8],
    };
    const threshold_x = threshold[language][0];
    const threshold_y = threshold[language][1];

    //求平均分
    const words_merged: Word[] = [];
    for (const key of uniqueKeys) {
      const [surface, ner_type] = key.split('_');
      let group = words.filter(
        (w) => w.surface === surface && w.ner_type === ner_type,
      );
      let word = group[0];

      word.score = Math.min(
        0.9999,
        group.reduce((sum, w) => sum + w.score, 0) / group.length,
      );

      if (
        (word.ner_type === 'PER' && word.score > threshold_x) ||
        (word.ner_type !== 'PER' && word.score > threshold_y)
      ) {
        words_merged.push(word);
      }
    }

    const words_categorized: { [key: string]: Word[] } = {};
    for (const word of words_merged) {
      if (!words_categorized[word.ner_type]) {
        words_categorized[word.ner_type] = [];
      }
      words_categorized[word.ner_type].push(word);
    }

    const words_counted: Word[] = [];
    for (const words_in_category of Object.values(words_categorized)) {
      //按词语长度从长到短排序，优先统计较长的词语
      words_in_category.sort((a, b) => b.surface.length - a.surface.length);
      let lines_joined = contentLines.join('');

      for (const word of words_in_category) {
        //Python原代碼 matches = re.findall(re.escape(word.surface), lines_joined)
        const escapedSurface = word.surface.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        const regex = new RegExp(escapedSurface, 'g');
        const matches = lines_joined.match(regex);

        const count = matches ? matches.length : 0;
        word.count = count;
        words_counted.push(word);

        //用特殊标记替换已统计的词语，防止子串重复计数
        const replacement = '#'.repeat(word.surface.length);
        lines_joined = lines_joined.replace(regex, replacement);
      }
    }

    return words_counted.sort((a, b) => b.count! - a.count!);
  }

  getWordsByNerType(words: Word[], nertype: NERTYPE): Word[] {
    return words.filter((w) => w.ner_type == nertype);
  }

  removeWordsByNerType(words: Word[], nertype: NERTYPE): Word[] {
    return words.filter((w) => w.ner_type != nertype);
  }

  replaceWordsByNerType(
    words: Word[],
    inWords: Word[],
    nertype: NERTYPE,
  ): Word[] {
    words = this.removeWordsByNerType(words, nertype);
    return words.concat(inWords);
  }

  removeWordsByCountThresHold(words: Word[], count: number): [Word[], number] {
    const filteredWords = words.filter((word) => word.count >= count);
    return [filteredWords, words.length - filteredWords.length];
  }

  validateWordsByDuplication(words: Word[]): Word[] {
    const personWords = this.getWordsByNerType(words, NERTYPE.PER);

    words.forEach((w) => {
      if (w.ner_type == NERTYPE.PER) return;
      if (
        personWords.map((w) => w.surface).some((v) => w.surface.includes(v))
      ) {
        this.logger.info(`重複性校驗 剔除詞語 ${w.surface} - ${w.ner_type}`);
        w.ner_type = NERTYPE.EMPTY;
      }
    });

    return words;
  }

  lemmatizeWordsByMorphology(words: Word[]): Word[] {
    const wordsEx: Word[] = [];

    words.forEach((word) => {
      // 以下步骤只对角色实体进行
      if (word.ner_type !== NERTYPE.PER) return;

      // 前面的步骤中已经移除了首尾的 の，如果还有，那就是 AのB 的形式，跳过
      if (word.surface.includes('の')) return;

      // 如果开头结尾都是汉字，跳过
      if (
        TextHelper.is_cjk(word.surface[0]) &&
        TextHelper.is_cjk(word.surface[word.surface.length - 1])
      )
        return;

      // 拆分词根
      const tokens = TextHelper.extract_japanese(word.surface);

      // 如果已不能再拆分，跳过
      if (tokens.length === 1) return;

      // 获取词根，获取成功则更新词语
      const roots: string[] = [];
      tokens.forEach((v) => {
        if (TextHelper.is_valid_japanese_word(v, this.blacklist)) {
          const wordEx = new Word(v, word.ner_type, word.count, word.score);

          roots.push(v);
          wordsEx.push(wordEx);
        }
      });

      if (roots.length > 0) {
        this.logger.info(
          `通过词语形态还原词根 ${word.ner_type} - ${word.surface} ${roots.join(' / ')}`,
        );
        word.ner_type = '';
      }
    });

    words.push(...wordsEx);
    return words;
  }

  wordsToGlossary(words: Word[]): WGlossary {
    const glossarys: WGlossary = {};
    words.forEach((word) => {
      glossarys[word.surface] = {
        zh: word.surface_translation[0],
        count: word.count,
        info: word.toString(),
      };
    });
    return glossarys;
  }
}
