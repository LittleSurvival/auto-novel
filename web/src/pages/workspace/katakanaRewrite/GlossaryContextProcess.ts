import { Locator } from '@/data';
import { GlossaryWorker } from '@/model/IGlossary';
import { Word } from './model/Word';
import { NERTYPE } from './model/NerType';
import { PromptHelper } from './helper/PromptHelper';
import { TextHelper } from './helper/TextHelper';
import { LogHelper } from './helper/LogHelper';

export enum TaskType {
  ApiTest = 'ApiTest',
  SummarizeContext = 'SummarizeContext',
  TranslateSurface = 'TranslateSurface',
  TranslateContext = 'TranslateContext',
}

interface Response {
  message: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  responseRaw: string;
  error: unknown;
}

export class GlosssaryContextProcessor {
  private config: GlossaryWorker;
  private api;
  private logger: LogHelper;
  private blacklist: string[] = [];
  private TranslateIndex: Record<
    TaskType,
    {
      TEMPERATURE: number;
      TOP_P: number;
      MAX_TOKENS: number;
      FREQUENCY_PENALTY: number;
    }
  > = {
    ApiTest: {
      TEMPERATURE: 0.05,
      TOP_P: 0.85,
      MAX_TOKENS: 768,
      FREQUENCY_PENALTY: 0,
    },
    SummarizeContext: {
      TEMPERATURE: 0.05,
      TOP_P: 0.85,
      MAX_TOKENS: 768,
      FREQUENCY_PENALTY: 0,
    },
    TranslateSurface: {
      TEMPERATURE: 0.05,
      TOP_P: 0.85,
      MAX_TOKENS: 768,
      FREQUENCY_PENALTY: 0,
    },
    TranslateContext: {
      TEMPERATURE: 0.75,
      TOP_P: 0.95,
      MAX_TOKENS: 1024,
      FREQUENCY_PENALTY: 0,
    },
  };

  TaskTypeInfo = {
    [TaskType.ApiTest]: '接口測試',
    [TaskType.SummarizeContext]: '語意分析',
    [TaskType.TranslateSurface]: '詞語翻譯',
    [TaskType.TranslateContext]: '上下文翻譯',
  };

  TaskFunctions: Record<
    TaskType,
    (word: Word, retry: boolean) => Promise<Word | undefined>
  > = {
    [TaskType.ApiTest]: async () => {
      return undefined;
    },
    [TaskType.SummarizeContext]: async (word: Word, retry: boolean) => {
      return await this.summarizeContext(word, retry);
    },
    [TaskType.TranslateContext]: async (word: Word, retry: boolean) => {
      return await this.translateContext(word, retry);
    },
    [TaskType.TranslateSurface]: async (word: Word, retry: boolean) => {
      return await this.translateSurface(word, retry);
    },
  };

  private MAX_RETRY = 2;

  constructor(config: GlossaryWorker, logger: LogHelper) {
    this.config = config;
    this.logger = logger;
    this.api = Locator.openAiRepositoryFactory(
      config.baseurl,
      config.apikey,
      config.timeout,
    );
  }

  loadBlackList = (blacklist: string[]) => {
    this.blacklist = blacklist;
  };

  async request(
    content: string,
    taskType: TaskType,
    retry: boolean = false,
  ): Promise<Response> {
    try {
      const completion = await this.api.createChatCompletions(
        {
          model: this.config.modelname,
          messages: [
            {
              role: 'user',
              content: content,
            },
          ],
          temperature: this.TranslateIndex[taskType].TEMPERATURE,
          top_p: this.TranslateIndex[taskType].TOP_P,
          max_tokens: this.TranslateIndex[taskType].MAX_TOKENS,
          frequency_penalty: retry
            ? this.TranslateIndex[taskType].FREQUENCY_PENALTY + 0.2
            : this.TranslateIndex[taskType].FREQUENCY_PENALTY,
        },
        {
          timeout: false,
        },
      );
      return {
        message: completion.choices[0].message.content!!,
        usage: completion.usage,
        responseRaw: JSON.stringify(completion),
        error: undefined,
      };
    } catch (ex) {
      return {
        message: '獲取失敗',
        usage: {
          completion_tokens: 0,
          prompt_tokens: 0,
          total_tokens: 0,
        },
        responseRaw: '',
        error: ex,
      };
    }
  }

  async apiTest() {
    //TODO
  }

  async doTaskBatch(
    words: Word[],
    wordsFailed: Word[],
    wordsSuccessed: Word[],
    taskType: TaskType,
  ): Promise<{
    wordsFailed: Word[];
    wordsSuccessed: Word[];
  }> {
    const retry = wordsFailed.length > 0;
    const wordsThisRound = retry ? wordsFailed : words;
    let completed = 0;

    const tasks: Promise<void>[] = [];

    this.logger.startProgress(
      `${this.TaskTypeInfo[taskType]}`,
      wordsThisRound.length,
    );
    await this.processTasksWithLimit(
      wordsThisRound,
      async (word, _) => {
        try {
          const result = await this.TaskFunctions[taskType](word, retry);

          if (result != undefined) {
            this.logger.updateProgress(++completed, wordsThisRound.length);
            wordsSuccessed.push(result);
          }
        } catch (error) {
          this.logger.error(`處理詞語時錯誤 : ${word.surface} - ${error}`);
        }
      },
      this.config.requestfrequency,
    );

    //等待非同步任務完成
    await Promise.allSettled(tasks);
    this.logger.finishProgress();

    //獲取失敗任務列表
    const successedWordPairs = new Set(
      wordsSuccessed.map((word) => `${word.surface}_${word.ner_type}`),
    );
    const updatedWordsFailed = words.filter(
      (word) => !successedWordPairs.has(`${word.surface}_${word.ner_type}`),
    );

    return {
      wordsFailed: updatedWordsFailed,
      wordsSuccessed,
    };
  }

  async doTask(words: Word[], taskType: TaskType): Promise<Word[]> {
    let wordsFailed: Word[] = [];
    let wordsSuccessed: Word[] = [];

    ({ wordsFailed, wordsSuccessed } = await this.doTaskBatch(
      words,
      wordsFailed,
      wordsSuccessed,
      taskType,
    ));

    if (wordsFailed.length > 0) {
      for (let i = 0; i < this.MAX_RETRY; i++) {
        this.logger.warning(
          `${this.TaskTypeInfo[taskType]} 開始第 ${i + 1} / ${this.MAX_RETRY} 輪重試`,
        );

        ({ wordsFailed, wordsSuccessed } = await this.doTaskBatch(
          words,
          wordsFailed,
          wordsSuccessed,
          taskType,
        ));

        if (wordsFailed.length === 0) break;
      }
    }
    return words;
  }

  async translateSurface(
    word: Word,
    retry: boolean,
  ): Promise<Word | undefined> {
    // async with self.semaphore, self.async_limiter:
    try {
      let prompt = '';
      if (word.ner_type != NERTYPE.PER) {
        prompt = PromptHelper.PROMPT_TRANSLATE_SURFACE_COMMON.replace(
          '{surface}',
          word.surface,
        );
      } else {
        prompt = PromptHelper.PROMPT_TRANSLATE_SURFACE_PERSON.replace(
          '{attribute}',
          word.attribute,
        ).replace('{surface}', word.surface);
      }
      const response = await this.request(
        prompt,
        TaskType.TranslateSurface,
        retry,
      );

      if (
        response.usage.completion_tokens >=
        this.TranslateIndex[TaskType.TranslateSurface].MAX_TOKENS
      ) {
        this.logger.warning('Token過載，子任务执行失败，稍后将重试 ...');
        return;
      }

      const data = JSON.parse(
        TextHelper.fixBrokenJsonString(response.message.trim()),
      );

      word.surface_romaji = data.romaji !== word.surface ? data.romaji : '';
      word.surface_translation = [
        data.translation_1 ?? '',
        data.translation_2 ?? '',
      ];
      word.surface_translation_description = data.description;
      word.llmresponse_translate_surface = response.responseRaw;

      return word;
    } catch (ex) {
      this.logger.warning(`子任务执行失败，稍后将重试 ... ${ex}`);
    }
  }

  async translateContext(
    word: Word,
    retry: boolean,
  ): Promise<Word | undefined> {
    try {
      const completion = await this.request(
        PromptHelper.PROMPT_TRANSLATE_CONTEXT.replace(
          '{context}',
          word.context.join('\n'),
        ),
        TaskType.TranslateContext,
        retry,
      );

      if (completion.error) return undefined;
      if (
        completion.usage.completion_tokens >=
        this.TranslateIndex[TaskType.TranslateContext].MAX_TOKENS
      ) {
        this.logger.warning('Token過載，子任务执行失败，稍后将重试 ...');
        return undefined;
      }

      const contextTranslation: string[] = [];

      completion.message
        .split('\n')
        .filter((line) => line.length > 0)
        .forEach((line) => contextTranslation.push(line));

      word.context_translation = contextTranslation;
      word.llmresponse_summarize_context = completion.responseRaw;

      return word;
    } catch (ex) {
      this.logger.warning('上下文翻譯 子任務執行失敗，稍後將重試');
      return undefined;
    }
  }

  async summarizeContext(
    word: Word,
    retry: boolean,
  ): Promise<Word | undefined> {
    try {
      const completion = await this.request(
        PromptHelper.PROMPT_SUMMARIZE_CONTEXT.replace(
          '{surface}',
          word.surface,
        ).replace('{context}', word.context.join('\n')),
        TaskType.SummarizeContext,
        retry,
      );
      if (completion.error) return undefined;
      if (
        completion.usage.completion_tokens >=
        this.TranslateIndex[TaskType.SummarizeContext].MAX_TOKENS
      ) {
        this.logger.warning('Token過載，子任务执行失败，稍后将重试 ...');
        return undefined;
      }

      const result = JSON.parse(
        TextHelper.fixBrokenJsonString(completion.message.trim()),
      );

      if (result['is_name'].includes('否')) {
        word.ner_type = NERTYPE.EMPTY;
        this.logger.info(
          `[语义分析] 已剔除 - ${word.surface} - ${JSON.stringify(result)}`,
        );
      } else {
        this.logger.debug(
          `[语义分析] 已完成 - ${word.surface} - ${JSON.stringify(result)}`,
        );
      }

      word.attribute = result.sex;
      word.context_summary = result;
      word.llmresponse_summarize_context = completion.responseRaw;

      return word;
    } catch (ex) {
      this.logger.warning(`子任务执行失败，稍后将重试 ... ${ex as string}`);
      return undefined;
    }
  }

  async processTasksWithLimit<T>(
    items: T[],
    worker: (item: T, index: number) => Promise<void>,
    concurrency: number,
  ): Promise<void> {
    let currentIndex = 0;

    const execute = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        await worker(items[index], index);
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(execute());
    }

    await Promise.all(workers);
  }
}
