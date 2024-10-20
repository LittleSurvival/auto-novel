import { get_encoding } from 'tiktoken';
import { LogHelper } from '../../katakanaRewrite/helper/LogHelper';

export class Word {
  score: number;
  count: number;
  context: string[];
  context_summary: string;
  context_translation: string[];
  surface: string;
  surface_romaji: string;
  surface_translation: string;
  surface_translation_description: string;
  ner_type: string;
  attribute: string;
  llmresponse_summarize_context: string;
  llmresponse_translate_context: string;
  llmresponse_translate_surface: string;

  tiktoken_encoding: any; // Placeholder type for tokenizer encoding

  constructor() {
    this.score = 0;
    this.count = 0;
    this.context = [];
    this.context_summary = '';
    this.context_translation = [];
    this.surface = '';
    this.surface_romaji = '';
    this.surface_translation = '';
    this.surface_translation_description = '';
    this.ner_type = '';
    this.attribute = '';
    this.llmresponse_summarize_context = '';
    this.llmresponse_translate_context = '';
    this.llmresponse_translate_surface = '';

    this.tiktoken_encoding = get_encoding('cl100k_base');
  }

  toString(): string {
    return (
      `Word(score=${this.score},` +
      `count=${this.count},` +
      `context=${JSON.stringify(this.context)},` +
      `context_summary=${this.context_summary},` +
      `context_translation=${JSON.stringify(this.context_translation)},` +
      `surface=${this.surface},` +
      `surface_romaji=${this.surface_romaji},` +
      `surface_translation=${this.surface_translation},` +
      `surface_translation_description=${this.surface_translation_description},` +
      `ner_type=${this.ner_type},` +
      `attribute=${this.attribute},` +
      `llmresponse_summarize_context=${this.llmresponse_summarize_context},` +
      `llmresponse_translate_context=${this.llmresponse_translate_context},` +
      `llmresponse_translate_surface=${this.llmresponse_translate_surface})`
    );
  }

  clipContext(threshold: number, logger: LogHelper): string[] {
    if (!this.context || this.context.length === 0) {
      logger.debug(
        `${this.surface} - ${this.ner_type} - ${this.count} - ${this.context} ...`,
      );
      return [];
    }

    const context: string[] = [];
    let contextLength = 0;

    for (const line of this.context) {
      const lineLength = this.tiktoken_encoding.encode(line).length;

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
        const prevDiff = Math.abs(
          this.tiktoken_encoding.encode(prevLine).length - threshold,
        );
        const currentDiff = Math.abs(
          this.tiktoken_encoding.encode(currentLine).length - threshold,
        );
        return currentDiff < prevDiff ? currentLine : prevLine;
      });
      context.push(closestLine);
    }

    return context;
  }
}
