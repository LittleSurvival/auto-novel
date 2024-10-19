import { TextHelper } from './helper/TextHelper';
import { LogHelper } from './helper/LogHelper';
import { LANGUAGE } from './WordNER';

class KataKataApi {
  constructor(logger: LogHelper) {}

  readInputText = async (content: string, name: string) => {
    const lines = content.split('\n');
    const input_lines_filtered = [];

    for (let line of lines) {
      line = content.trim().replace('\\N', '');
      // Remove codes for enlarging or reducing font size.
      // Example: \{\{ゴゴゴゴゴゴゴゴゴッ・・・\r\n（大地の揺れる音）
      line = line.replace(/(\\{)|(\\})/g, '');

      // Remove codes like /C[4].
      line = line.replace(/\/[A-Z]{1,5}\[\d+\]/gi, '');

      // Remove codes like \FS[29].
      line = line.replace(/\\[A-Z]{1,5}\[\d+\]/gi, '');

      // For codes like \nw[隊員Ｃ], remove the part before the '['.
      line = line.replace(/\\[A-Z]{1,5}\[/gi, '[');

      // Remove empty name frames that might result from the above removals.
      line = line.replace('【】', '');

      // Remove inline whitespace characters other than spaces (including newlines, tabs, carriage returns, form feeds, etc.).
      line = line.replace(/[^\S ]+/g, '');

      // Merge consecutive spaces into a single space.
      line = line.replace(/ +/g, ' ');

      if (line.length === 0) {
        continue;
      }

      if (language === LANGUAGE.ZH && !TextHelper.has_any_cjk(line)) {
        continue;
      }

      if (language === LANGUAGE.EN && !TextHelper.has_any_latin(line)) {
        continue;
      }

      if (language === LANGUAGE.JP && !TextHelper.has_any_japanese(line)) {
        continue;
      }

      if (language === LANGUAGE.KR && !TextHelper.has_any_korean(line)) {
        continue;
      }
      input_lines_filtered.push(line.trim());
    }

    LogHelper.info(
      `已读取到文本 ${input_lines.length} 行，其中有效文本 ${input_lines_filtered.length} 行, 角色名 ${input_names.length} 个...`,
    );
    return [input_lines_filtered, input_names];
  };
}
