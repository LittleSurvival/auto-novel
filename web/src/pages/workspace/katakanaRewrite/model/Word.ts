import { LogHelper } from '../../katakanaRewrite/helper/LogHelper';

export class Word {
  score: number;
  count: number;
  context: string[];
  contextSummary: string;
  contextTranslation: string[];
  surface: string;
  surfaceRomaji: string;
  surfaceTranslation: string[];
  surfaceTranslationDescription: string;
  nerType: string;
  attribute: string;
  llmresponseSummarizeContext: string;
  llmresponseTranslateContext: string;
  llmresponseTranslateSurface: string;

  tiktokenEncoding: any; // Placeholder type for tokenizer encoding
  CONTEXT_TOKEN_THRESHOLD = 768; // 上下文 token 阈值

  static MATCH_LENGTHS_CACHE: Record<string, number> = {}; //靜態緩存

  constructor(
    surface: string = '',
    ner_type: string = '',
    count: number = 0,
    score = 0,
  ) {
    this.score = score;
    this.count = count;
    this.context = [];
    this.contextSummary = '';
    this.contextTranslation = [];
    this.surface = surface;
    this.surfaceRomaji = '';
    this.surfaceTranslation = [];
    this.surfaceTranslationDescription = '';
    this.nerType = ner_type;
    this.attribute = '';
    this.llmresponseSummarizeContext = '';
    this.llmresponseTranslateContext = '';
    this.llmresponseTranslateSurface = '';
  }

  toString(): string {
    return `
      score=${this.score}
      count=${this.count}
      context=${JSON.stringify(this.context)}
      context_summary=${this.contextSummary}
      context_translation=${JSON.stringify(this.contextTranslation)}
      surface=${this.surface}
      surface_romaji=${this.surfaceRomaji}
      surface_translation=${this.surfaceTranslation}
      surface_translation_description=${this.surfaceTranslationDescription}
      ner_type=${this.nerType}
      attribute=${this.attribute}
      llmresponse_summarize_context=${this.llmresponseSummarizeContext}
      llmresponse_translate_context=${this.llmresponseTranslateContext}
      llmresponse_translate_surface=${this.llmresponseTranslateSurface}
      `;
  }

  async searchContext(original: string[], words: Word[]): Promise<string[]> {
    const { encode } = await import('gpt-tokenizer');
    // 1. 从 words 中找出 self.surface 的母串
    const replacements = new Set<string>(
      words
        .filter(
          (word) =>
            word.surface.includes(this.surface) &&
            word.surface !== this.surface,
        )
        .map((word) => word.surface),
    );

    // 2. 计算并缓存所有匹配句子的长度
    const match_lengths: Record<string, number> = {};

    for (let line of original) {
      // 替换母串为 #
      for (const key of replacements) {
        if (line.includes(key)) {
          const regex = new RegExp(
            key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'g',
          );
          line = line.replace(regex, '#'.repeat(key.length));
        }
      }

      // 在替换后的 line 中匹配 self.surface
      if (line.includes(this.surface)) {
        if (!(line in Word.MATCH_LENGTHS_CACHE)) {
          Word.MATCH_LENGTHS_CACHE[line] = encode(line).length;
        }
        match_lengths[line] = Word.MATCH_LENGTHS_CACHE[line];
      }
    }

    // 3. 按长度降序排序
    const sorted_matches = Object.entries(match_lengths).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );

    // 4. 构建上下文，尽可能接近阈值
    const context: string[] = [];
    let context_length = 0;
    let closest_match: string | null = null;
    let closest_difference = Infinity;

    for (const [line, length] of sorted_matches) {
      if (length > this.CONTEXT_TOKEN_THRESHOLD) {
        const difference = length - this.CONTEXT_TOKEN_THRESHOLD;
        if (difference < closest_difference) {
          closest_difference = difference;
          closest_match = line;
        }
        continue;
      }

      if (context_length + length > this.CONTEXT_TOKEN_THRESHOLD) {
        break;
      }

      context.push(line);
      context_length += length;
    }

    // 5. 如果没有合适的上下文，并且有一个接近阈值的句子
    if (context.length === 0 && closest_match) {
      context.push(closest_match);
    }

    return context;
  }

  async clipContext(threshold: number, logger: LogHelper): Promise<string[]> {
    const { encode } = await import('gpt-tokenizer');

    if (!this.context || this.context.length === 0) {
      logger.debug(
        `${this.surface} - ${this.nerType} - ${this.count} - ${this.context} ...`,
      );
      return [];
    }

    const context: string[] = [];
    let contextLength = 0;

    for (const line of this.context) {
      const lineLength = encode(line).length;

      if (lineLength > threshold) {
        continue;
      }
      if (contextLength + lineLength > threshold) {
        break;
      }

      context.push(line);
      contextLength += lineLength;
    }

    if (context.length === 0) {
      const closestLine = this.context.reduce((prevLine, currentLine) => {
        const prevDiff = Math.abs(encode(prevLine).length - threshold);
        const currentDiff = Math.abs(encode(currentLine).length - threshold);
        return currentDiff < prevDiff ? currentLine : prevLine;
      });
      context.push(closestLine);
    }

    return context;
  }
}