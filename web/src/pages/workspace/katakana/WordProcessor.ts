import Bottleneck from 'bottleneck';
import { Sema } from 'async-sema';
import wanakana from 'wanakana';
import { LogHelper } from './helper/LogHelper';
import { TextHelper } from './helper/TextHelper';
import { Word } from './Word';
import { Locator } from '@/data';
import { PromptHelper } from './helper/PromptHelper';

interface Config {
  api_key: string;
  base_url: string;
  model_name: string;
  request_timeout: number;
  request_frequency_threshold: number;
  blacklist: string[];
}

interface LLMConfig {
  TEMPERATURE: number;
  TOP_P: number;
  MAX_TOKENS: number;
  FREQUENCY_PENALTY: number;
}

enum TaskType {
  API_TEST = 10,
  SUMMARIZE_CONTEXT = 20,
  TRANSLATE_SURFACE = 30,
  TRANSLATE_CONTEXT = 40,
}

enum ProcessMode {
  NORMAL = 1,
  QUICK = 2,
}

export class WordProcess {
  private static MAX_RETRY: number = 3;

  // Request configuration parameters
  private LLMCONFIG: { [key: number]: LLMConfig } = {};

  // Configuration parameters
  private api_key: string;
  private base_url: string;
  private model_name: string;
  private request_timeout: number;
  private request_frequency_threshold: number;

  // Prompt templates
  private prompt_summarize_context: string =
    PromptHelper.PROMPT_SUMMARIZE_CONTEXT;
  private prompt_translate_context: string =
    PromptHelper.PROMPT_TRANSLATE_CONTEXT;
  private prompt_translate_surface_common: string =
    PromptHelper.PROMPT_TRANSLATE_SURFACE_COMMON;
  private prompt_translate_surface_person: string =
    PromptHelper.PROMPT_TRANSLATE_SURFACE_PERSON;

  // Rate limiting and semaphore
  private semaphore: Sema;
  private limiter: Bottleneck;
  private logger: LogHelper;
  private api;

  constructor(config: Config, logger: LogHelper) {
    this.logger = logger;

    this.api_key = config.api_key;
    this.base_url = config.base_url;
    this.model_name = config.model_name;
    this.request_timeout = config.request_timeout;
    this.request_frequency_threshold = config.request_frequency_threshold;

    this.initializeLLMConfig();

    // Initialize semaphore and rate limiter with default values
    this.semaphore = new Sema(
      this.request_frequency_threshold > 0
        ? this.request_frequency_threshold
        : 1,
    );
    this.limiter = new Bottleneck({
      maxConcurrent:
        this.request_frequency_threshold > 0
          ? this.request_frequency_threshold
          : 1,
      minTime:
        this.request_frequency_threshold > 0
          ? 1000 / this.request_frequency_threshold
          : 1000,
    });
    this.api = Locator.openAiRepositoryFactory(
      this.base_url,
      this.api_key || 'no-key',
    );
  }

  private initializeLLMConfig() {
    this.LLMCONFIG[TaskType.API_TEST] = {
      TEMPERATURE: 0.05,
      TOP_P: 0.85,
      MAX_TOKENS: 768,
      FREQUENCY_PENALTY: 0,
    };

    this.LLMCONFIG[TaskType.SUMMARIZE_CONTEXT] = {
      TEMPERATURE: 0.05,
      TOP_P: 0.85,
      MAX_TOKENS: 768,
      FREQUENCY_PENALTY: 0,
    };

    this.LLMCONFIG[TaskType.TRANSLATE_SURFACE] = {
      TEMPERATURE: 0.05,
      TOP_P: 0.85,
      MAX_TOKENS: 768,
      FREQUENCY_PENALTY: 0,
    };

    this.LLMCONFIG[TaskType.TRANSLATE_CONTEXT] = {
      TEMPERATURE: 0.75,
      TOP_P: 0.95,
      MAX_TOKENS: 1024,
      FREQUENCY_PENALTY: 0,
    };
  }

  /**
   * Checks if the word's description contains any of the specified keywords.
   * @param word - The word to check.
   * @param keywords - List of keywords to look for.
   * @returns True if any keyword is found, otherwise false.
   */
  checkKeywordInDescription(
    word: Word,
    keywords: string[] = [
      '人名',
      '名字',
      '姓氏',
      '姓名',
      '名称',
      '昵称',
      '角色名',
    ],
  ): boolean {
    return keywords.some((keyword) =>
      word.surface_translation_description.includes(keyword),
    );
  }

  /**
   * Makes a request to the OpenAI API.
   * @param content - The content to send.
   * @param task_type - The type of task.
   * @param retry - Whether this is a retry attempt.
   * @returns An object containing usage, message, request, response, and error.
   */
  async request(
    content: string,
    task_type: TaskType,
    retry: boolean = false,
  ): Promise<{
    usage: any;
    message: any;
    llm_request: any;
    llm_response: any;
    error: any;
  }> {
    let usage = null;
    let message = null;
    let llm_request = null;
    let llm_response = null;
    let error = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.request_timeout * 1000);

      const completions = await this.api.createChatCompletions(
        {
          model: this.model_name,
          messages: [
            {
              role: 'user',
              content: content,
            },
          ],
          temperature: this.LLMCONFIG[task_type].TEMPERATURE,
          top_p: this.LLMCONFIG[task_type].TOP_P,
          max_tokens: this.LLMCONFIG[task_type].MAX_TOKENS,
          frequency_penalty: retry
            ? this.LLMCONFIG[task_type].FREQUENCY_PENALTY + 0.2
            : this.LLMCONFIG[task_type].FREQUENCY_PENALTY,
        },
        {
          signal: controller.signal,
          timeout: false,
        },
      );

      clearTimeout(timeout);

      llm_request = completions.completion_probabilities;
      llm_response = completions.choices;
      usage = completions.usage.completion_tokens;
      message = completions.choices[0].message.content!!;
    } catch (e: any) {
      error = e;
    } finally {
      return { usage, message, llm_request, llm_response, error };
    }
  }

  /**
   * Performs an API test to verify the configuration and connectivity.
   * @returns {Promise<boolean>} - Returns true if the test is successful, otherwise false.
   */
  async apiTest(): Promise<boolean> {
    await this.semaphore.acquire();

    try {
      let result = false;
      let llm_request: any = null;
      let llm_response: any = null;

      const testPrompt = this.prompt_translate_surface_person
        .replace('{surface}', 'ダリヤ')
        .replace('{context}', '魔導具師ダリヤはうつむかない');

      const {
        usage,
        message,
        llm_request: req,
        llm_response: res,
        error,
      } = await this.request(testPrompt, TaskType.API_TEST, true);

      llm_request = req;
      llm_response = res;

      if (error) {
        throw error;
      }

      if (
        usage &&
        usage.completion_tokens >= this.LLMCONFIG[TaskType.API_TEST].MAX_TOKENS
      ) {
        throw new Error('usage.completion_tokens >= MAX_TOKENS');
      }

      const data = JSON.parse(
        TextHelper.fix_broken_json_string(message.content.trim()),
      );

      result = true;
      this.logger.info(`${JSON.stringify(data)}`);

      return result;
    } catch (e: any) {
      this.logger.warning(`${e.stack || e}`);
      this.logger.warning(`llm_request - ${JSON.stringify(e.llm_request)}`);
      this.logger.warning(`llm_response - ${JSON.stringify(e.llm_response)}`);
      return false;
    } finally {
      this.semaphore.release();
    }
  }

  async translateSurface(word: Word, retry: boolean): Promise<Word | Error> {
    await this.semaphore.acquire();
    let requestText = '',
      responseText = '';
    try {
      let prompt: string;
      if (word.ner_type !== 'PER') {
        prompt = this.prompt_translate_surface_common.replace(
          '{surface}',
          word.surface,
        ); // Handle common translation
      } else {
        prompt = this.prompt_translate_surface_person
          .replace('{attribute}', word.attribute)
          .replace('{surface}', word.surface); // Handle person-specific translation
      }

      const { usage, message, llm_request, llm_response, error } =
        await this.request(prompt, TaskType.TRANSLATE_SURFACE, retry);

      requestText = llm_request;
      responseText = llm_response;

      if (error) {
        throw error;
      }

      if (
        usage &&
        usage.completion_tokens >=
          this.LLMCONFIG[TaskType.TRANSLATE_SURFACE].MAX_TOKENS
      ) {
        throw new Error('usage.completion_tokens >= MAX_TOKENS');
      }

      const data = JSON.parse(
        TextHelper.fix_broken_json_string(message.trim()),
      );

      word.surface_romaji =
        data.romaji && data.romaji !== word.surface
          ? data.romaji
          : await this.convertToRomaji(word.surface); // Updated Romaji extraction
      word.surface_translation = [
        data.translation_1?.trim() || '',
        data.translation_2?.trim() || '',
      ]; // Updated to handle multiple translations
      word.surface_translation_description = data.description?.trim() || '';
      word.llmresponse_translate_surface = llm_response;
    } catch (e: any) {
      this.logger.warning(
        `[Translate Surface] Subtask failed, will retry later... ${e.stack || e}`,
      );
      this.logger.debug(`llm_request - ${JSON.stringify(requestText)}`);
      this.logger.debug(`llm_response - ${JSON.stringify(responseText)}`);
      return e;
    } finally {
      this.semaphore.release();
    }
    return word;
  }

  private onTranslateSurfaceTaskDone(
    result: Word | Error,
    words: Word[],
    words_failed: Word[],
    words_successed: Word[],
  ): void {
    if (!(result instanceof Error)) {
      words_successed.push(result);
      this.logger.info(
        `[词语翻译] 已完成 ${words_successed.length} / ${words.length} ...`,
      );
    }
  }

  private async doTranslateSurfaceBatch(
    words: Word[],
    words_failed: Word[],
    words_successed: Word[],
  ): Promise<[Word[], Word[]]> {
    let retry: boolean;
    let words_this_round: Word[];

    if (words_failed.length === 0) {
      retry = false;
      words_this_round = words;
    } else {
      retry = true;
      words_this_round = words_failed;
    }

    const tasks = words_this_round.map(async (word) => {
      const result = await this.translateSurface(word, retry);
      this.onTranslateSurfaceTaskDone(
        result,
        words,
        words_failed,
        words_successed,
      );
    });

    await Promise.all(tasks);

    const successed_word_pairs = new Set(
      words_successed.map((word) => `${word.surface}_${word.ner_type}`),
    );
    const new_words_failed = words.filter(
      (word) => !successed_word_pairs.has(`${word.surface}_${word.ner_type}`),
    );

    return [new_words_failed, words_successed];
  }

  async translateSurfaceBatch(words: Word[]): Promise<Word[]> {
    let words_failed: Word[] = [];
    let words_successed: Word[] = [];

    [words_failed, words_successed] = await this.doTranslateSurfaceBatch(
      words,
      words_failed,
      words_successed,
    );

    if (words_failed.length > 0) {
      for (let i = 0; i < WordProcess.MAX_RETRY; i++) {
        this.logger.warning(
          `[词语翻译] 即将开始第 ${i + 1} / ${WordProcess.MAX_RETRY} 轮重试...`,
        );

        [words_failed, words_successed] = await this.doTranslateSurfaceBatch(
          words_failed,
          [],
          words_successed,
        );

        if (words_failed.length === 0) {
          break;
        }
      }
    }

    return words_successed;
  }

  async translateContext(word: Word, retry: boolean): Promise<Word | Error> {
    await this.semaphore.acquire();
    try {
      const prompt = this.prompt_translate_context.replace(
        '{context}',
        word.context.join('\n'),
      );

      const { usage, message, llm_request, llm_response, error } =
        await this.request(prompt, TaskType.TRANSLATE_CONTEXT, retry);

      if (error) {
        throw error;
      }

      if (
        usage &&
        usage.completion_tokens >=
          this.LLMCONFIG[TaskType.TRANSLATE_CONTEXT].MAX_TOKENS
      ) {
        throw new Error('usage.completion_tokens >= MAX_TOKENS');
      }

      const context_translation = message.content
        .split('\n')
        .filter((line: string) => line.length > 0);

      word.context_translation = context_translation;
      word.llmresponse_translate_context = llm_response;
    } catch (e: any) {
      this.logger.warning(
        `[上下文翻译] 子任务执行失败，稍后将重试 ... ${e.stack || e}`,
      );
      this.logger.debug(`llm_request - ${JSON.stringify(e.llm_request)}`);
      this.logger.debug(`llm_response - ${JSON.stringify(e.llm_response)}`);
      return e;
    } finally {
      this.semaphore.release();
    }
    return word;
  }

  private onTranslateContextTaskDone(
    result: Word | Error,
    words: Word[],
    words_failed: Word[],
    words_successed: Word[],
  ): void {
    if (!(result instanceof Error)) {
      words_successed.push(result);
      this.logger.info(
        `[上下文翻译] 已完成 ${words_successed.length} / ${words.length} ...`,
      );
    }
  }

  private async doTranslateContextBatch(
    words: Word[],
    words_failed: Word[],
    words_successed: Word[],
  ): Promise<[Word[], Word[]]> {
    let retry: boolean;
    let words_this_round: Word[];

    if (words_failed.length === 0) {
      retry = false;
      words_this_round = words;
    } else {
      retry = true;
      words_this_round = words_failed;
    }

    const tasks = words_this_round.map(async (word) => {
      const result = await this.translateContext(word, retry);
      this.onTranslateContextTaskDone(
        result,
        words,
        words_failed,
        words_successed,
      );
    });

    await Promise.all(tasks);

    const successed_word_pairs = new Set(
      words_successed.map((word) => `${word.surface}_${word.ner_type}`),
    );
    const new_words_failed = words.filter(
      (word) => !successed_word_pairs.has(`${word.surface}_${word.ner_type}`),
    );

    return [new_words_failed, words_successed];
  }

  async translateContextBatch(words: Word[]): Promise<Word[]> {
    let words_failed: Word[] = [];
    let words_successed: Word[] = [];

    [words_failed, words_successed] = await this.doTranslateContextBatch(
      words,
      words_failed,
      words_successed,
    );

    if (words_failed.length > 0) {
      for (let i = 0; i < WordProcess.MAX_RETRY; i++) {
        this.logger.warning(
          `[上下文翻译] 即将开始第 ${i + 1} / ${WordProcess.MAX_RETRY} 轮重试...`,
        );

        [words_failed, words_successed] = await this.doTranslateContextBatch(
          words_failed,
          [],
          words_successed,
        );

        if (words_failed.length === 0) {
          break;
        }
      }
    }

    return words_successed;
  }

  async summarizeContext(
    word: Word,
    retry: boolean,
    mode: ProcessMode,
  ): Promise<Word | Error> {
    await this.semaphore.acquire();
    let requestText = '',
      responseText = '';
    try {
      if (mode === ProcessMode.QUICK) {
        word.ner_type = this.checkKeywordInDescription(word)
          ? word.ner_type
          : '';
      } else {
        const prompt = this.prompt_summarize_context
          .replace('{surface}', word.surface)
          .replace('{context}', word.context.join('\n'));

        const { usage, message, llm_request, llm_response, error } =
          await this.request(prompt, TaskType.SUMMARIZE_CONTEXT, retry);
        requestText = llm_request;
        responseText = llm_response;

        if (error) {
          throw error;
        }

        if (
          usage &&
          usage.completion_tokens >=
            this.LLMCONFIG[TaskType.SUMMARIZE_CONTEXT].MAX_TOKENS
        ) {
          throw new Error('usage.completion_tokens >= MAX_TOKENS');
        }

        const result = JSON.parse(
          TextHelper.fix_broken_json_string(message.content.trim()),
        );

        if (!result.is_name.includes('否')) {
          this.logger.debug(
            `[语义分析] 已完成 - ${word.surface} - ${JSON.stringify(result)}`,
          );
        } else {
          word.ner_type = '';
          this.logger.info(
            `[语义分析] 已剔除 - ${word.surface} - ${JSON.stringify(result)}`,
          );
        }

        word.attribute = result['sex'].trim() || '';
        word.context_summary = result.trim() || '';
        word.llmresponse_summarize_context = llm_response;
      }
    } catch (e: any) {
      this.logger.warning(
        `[语义分析] 子任务执行失败，稍后将重试 ... ${e.stack || e}`,
      );
      this.logger.debug(`llm_request - ${JSON.stringify(e.requestText)}`);
      this.logger.debug(`llm_response - ${JSON.stringify(e.responseText)}`);
      return e;
    } finally {
      this.semaphore.release();
    }
    return word;
  }

  private onSummarizeContextTaskDone(
    result: Word | Error,
    words: Word[],
    words_failed: Word[],
    words_successed: Word[],
  ): void {
    if (!(result instanceof Error)) {
      words_successed.push(result);
      this.logger.info(
        `[语义分析] 已完成 ${words_successed.length} / ${words.length} ...`,
      );
    }
  }

  private async doSummarizeContextBatch(
    words: Word[],
    words_failed: Word[],
    words_successed: Word[],
    mode: ProcessMode,
  ): Promise<[Word[], Word[]]> {
    let retry: boolean;
    let words_this_round: Word[];

    if (words_failed.length === 0) {
      retry = false;
      words_this_round = words;
    } else {
      retry = true;
      words_this_round = words_failed;
    }

    const tasks = words_this_round.map(async (word) => {
      const result = await this.summarizeContext(word, retry, mode);
      this.onSummarizeContextTaskDone(
        result,
        words,
        words_failed,
        words_successed,
      );
    });

    await Promise.all(tasks);

    const successed_word_pairs = new Set(
      words_successed.map((word) => `${word.surface}_${word.ner_type}`),
    );
    const new_words_failed = words.filter(
      (word) => !successed_word_pairs.has(`${word.surface}_${word.ner_type}`),
    );

    return [new_words_failed, words_successed];
  }

  async summarizeContextBatch(
    words: Word[],
    mode: ProcessMode,
  ): Promise<Word[]> {
    let words_failed: Word[] = [];
    let words_successed: Word[] = [];

    [words_failed, words_successed] = await this.doSummarizeContextBatch(
      words,
      words_failed,
      words_successed,
      mode,
    );

    if (words_failed.length > 0) {
      for (let i = 0; i < WordProcess.MAX_RETRY; i++) {
        this.logger.warning(
          `[语义分析] 即将开始第 ${i + 1} / ${WordProcess.MAX_RETRY} 轮重试...`,
        );

        [words_failed, words_successed] = await this.doSummarizeContextBatch(
          words_failed,
          [],
          words_successed,
          mode,
        );

        if (words_failed.length === 0) {
          break;
        }
      }
    }

    return words_successed;
  }

  private async convertToRomaji(text: string): Promise<string> {
    try {
      const romaji = wanakana.toRomaji(text, { upcaseKatakana: false });
      return romaji;
    } catch (e: any) {
      this.logger.error(`Error converting to Romaji: ${e.stack || e}`);
      return text; // Fallback to original text if conversion fails
    }
  }
}
