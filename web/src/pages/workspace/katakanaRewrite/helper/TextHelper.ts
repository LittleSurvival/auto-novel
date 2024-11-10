import { NERTYPE } from '../model/NerType';

export class TextHelper {
  // 平假名
  static readonly HIRAGANA: [number, number] = [0x3040, 0x309f];

  // 片假名
  static readonly KATAKANA: [number, number] = [0x30a0, 0x30ff];

  // 片假名语音扩展
  static readonly KATAKANA_PHONETIC_EXTENSIONS: [number, number] = [
    0x31f0, 0x31ff,
  ];

  // 濁音和半浊音符号
  static readonly VOICED_SOUND_MARKS: number[] = [0x309b, 0x309c];

  // 韩文字母 (Hangul Jamo)
  static readonly HANGUL_JAMO: [number, number] = [0x1100, 0x11ff];

  // 韩文字母扩展-A (Hangul Jamo Extended-A)
  static readonly HANGUL_JAMO_EXTENDED_A: [number, number] = [0xa960, 0xa97f];

  // 韩文字母扩展-B (Hangul Jamo Extended-B)
  static readonly HANGUL_JAMO_EXTENDED_B: [number, number] = [0xd7b0, 0xd7ff];

  // 韩文音节块 (Hangul Syllables)
  static readonly HANGUL_SYLLABLES: [number, number] = [0xac00, 0xd7af];

  // 韩文兼容字母 (Hangul Compatibility Jamo)
  static readonly HANGUL_COMPATIBILITY_JAMO: [number, number] = [
    0x3130, 0x318f,
  ];

  // 中日韩统一表意文字
  static readonly CJK: [number, number] = [0x4e00, 0x9fff];

  // 中日韩通用标点符号
  static readonly GENERAL_PUNCTUATION: [number, number] = [0x2000, 0x206f];
  static readonly CJK_SYMBOLS_AND_PUNCTUATION: [number, number] = [
    0x3000, 0x303f,
  ];
  static readonly HALFWIDTH_AND_FULLWIDTH_FORMS: [number, number] = [
    0xff00, 0xffef,
  ];
  static readonly OTHER_CJK_PUNCTUATION: number[] = [0x30fb]; // ・

  // 拉丁字符
  static readonly LATIN_1: [number, number] = [0x0041, 0x005a]; // A-Z
  static readonly LATIN_2: [number, number] = [0x0061, 0x007a]; // a-z
  static readonly LATIN_EXTENDED_A: [number, number] = [0x0100, 0x017f];
  static readonly LATIN_EXTENDED_B: [number, number] = [0x0180, 0x024f];
  static readonly LATIN_SUPPLEMENTAL: [number, number] = [0x00a0, 0x00ff];

  // 拉丁标点符号
  static readonly LATIN_PUNCTUATION_BASIC_1: [number, number] = [
    0x0020, 0x002f,
  ];
  static readonly LATIN_PUNCTUATION_BASIC_2: [number, number] = [
    0x003a, 0x0040,
  ];
  static readonly LATIN_PUNCTUATION_BASIC_3: [number, number] = [
    0x005b, 0x0060,
  ];
  static readonly LATIN_PUNCTUATION_BASIC_4: [number, number] = [
    0x007b, 0x007e,
  ];
  static readonly LATIN_PUNCTUATION_GENERAL: [number, number] = [
    0x2000, 0x206f,
  ];
  static readonly LATIN_PUNCTUATION_SUPPLEMENTAL: [number, number] = [
    0x2e00, 0x2e7f,
  ];

  static readonly RE_SPLIT_BY_PUNCTUATION = new RegExp(
    `[${TextHelper.GENERAL_PUNCTUATION[0]}-${TextHelper.GENERAL_PUNCTUATION[1]}` +
      `${TextHelper.CJK_SYMBOLS_AND_PUNCTUATION[0]}-${TextHelper.CJK_SYMBOLS_AND_PUNCTUATION[1]}` +
      `${TextHelper.HALFWIDTH_AND_FULLWIDTH_FORMS[0]}-${TextHelper.HALFWIDTH_AND_FULLWIDTH_FORMS[1]}` +
      `${TextHelper.LATIN_PUNCTUATION_BASIC_1[0]}-${TextHelper.LATIN_PUNCTUATION_BASIC_1[1]}` +
      `${TextHelper.LATIN_PUNCTUATION_BASIC_2[0]}-${TextHelper.LATIN_PUNCTUATION_BASIC_2[1]}` +
      `${TextHelper.LATIN_PUNCTUATION_BASIC_3[0]}-${TextHelper.LATIN_PUNCTUATION_BASIC_3[1]}` +
      `${TextHelper.LATIN_PUNCTUATION_BASIC_4[0]}-${TextHelper.LATIN_PUNCTUATION_BASIC_4[1]}` +
      `${TextHelper.LATIN_PUNCTUATION_GENERAL[0]}-${TextHelper.LATIN_PUNCTUATION_GENERAL[1]}` +
      `${TextHelper.LATIN_PUNCTUATION_SUPPLEMENTAL[0]}-${TextHelper.LATIN_PUNCTUATION_SUPPLEMENTAL[1]}` +
      `・♥]+`,
    'u',
  );

  // 判断一个字符是否是中日韩标点符号
  static isCJKpunctuation(char: string): boolean {
    const code = char.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return (
      (code >= TextHelper.GENERAL_PUNCTUATION[0] &&
        code <= TextHelper.GENERAL_PUNCTUATION[1]) ||
      (code >= TextHelper.CJK_SYMBOLS_AND_PUNCTUATION[0] &&
        code <= TextHelper.CJK_SYMBOLS_AND_PUNCTUATION[1]) ||
      (code >= TextHelper.HALFWIDTH_AND_FULLWIDTH_FORMS[0] &&
        code <= TextHelper.HALFWIDTH_AND_FULLWIDTH_FORMS[1]) ||
      TextHelper.OTHER_CJK_PUNCTUATION.includes(code)
    );
  }

  // 判断一个字符是否是拉丁标点符号
  static isLatinpunctuation(char: string): boolean {
    const code = char.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return (
      (code >= TextHelper.LATIN_PUNCTUATION_BASIC_1[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_BASIC_1[1]) ||
      (code >= TextHelper.LATIN_PUNCTUATION_BASIC_2[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_BASIC_2[1]) ||
      (code >= TextHelper.LATIN_PUNCTUATION_BASIC_3[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_BASIC_3[1]) ||
      (code >= TextHelper.LATIN_PUNCTUATION_BASIC_4[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_BASIC_4[1]) ||
      (code >= TextHelper.LATIN_PUNCTUATION_GENERAL[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_GENERAL[1]) ||
      (code >= TextHelper.LATIN_PUNCTUATION_SUPPLEMENTAL[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_SUPPLEMENTAL[1])
    );
  }

  // 判断一个字符是否是标点符号
  static isPunctuation(char: string): boolean {
    return (
      TextHelper.isCJKpunctuation(char) || TextHelper.isLatinpunctuation(char)
    );
  }

  // 判断字符是否为日文字符
  static isJapanese(ch: string): boolean {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return (
      (code >= TextHelper.CJK[0] && code <= TextHelper.CJK[1]) ||
      (code >= TextHelper.KATAKANA[0] && code <= TextHelper.KATAKANA[1]) ||
      (code >= TextHelper.HIRAGANA[0] && code <= TextHelper.HIRAGANA[1]) ||
      (code >= TextHelper.KATAKANA_PHONETIC_EXTENSIONS[0] &&
        code <= TextHelper.KATAKANA_PHONETIC_EXTENSIONS[1]) ||
      TextHelper.VOICED_SOUND_MARKS.includes(code)
    );
  }

  // 判断字符是否为中日韩汉字
  static isCJK(ch: string): boolean {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return code >= TextHelper.CJK[0] && code <= TextHelper.CJK[1];
  }

  // 判断输入的字符串是否全部由中日韩汉字组成
  static isAllCJK(text: string): boolean {
    return [...text].every((char) => TextHelper.isCJK(char));
  }

  // 检查字符串是否包含至少一个中日韩汉字
  static hasAnyCJK(text: string): boolean {
    return [...text].some((char) => TextHelper.isCJK(char));
  }

  // 判断字符是否为片假名
  static isKatakana(ch: string): boolean {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return code >= TextHelper.KATAKANA[0] && code <= TextHelper.KATAKANA[1];
  }

  // 判断字符串是否全部为片假名
  static isAllKatakana(text: string): boolean {
    return [...text].every((ch) => TextHelper.isKatakana(ch));
  }

  // 检查字符串是否包含至少一个片假名
  static hasAnyKatakana(text: string): boolean {
    return [...text].some((char) => TextHelper.isKatakana(char));
  }

  // 判断字符是否为平假名
  static isHiragana(ch: string): boolean {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return code >= TextHelper.HIRAGANA[0] && code <= TextHelper.HIRAGANA[1];
  }

  // 判断字符串是否全部为平假名
  static isAllHiragana(text: string): boolean {
    return [...text].every((ch) => TextHelper.isHiragana(ch));
  }

  // 检查字符串是否包含至少一个平假名
  static hasAnyHiragana(text: string): boolean {
    return [...text].some((char) => TextHelper.isHiragana(char));
  }

  // 判断输入的字符串是否全部由日文字符（含汉字）组成
  static isAllJapanese(text: string): boolean {
    return [...text].every((char) => TextHelper.isJapanese(char));
  }

  // 检查字符串是否包含至少一个日文字符（含汉字）
  static hasAnyJapanese(text: string): boolean {
    return [...text].some((char) => TextHelper.isJapanese(char));
  }

  // 移除开头结尾的标点符号
  static stripPunctuation(text: string): string {
    text = text.trim();

    while (text && TextHelper.isPunctuation(text.charAt(0))) {
      text = text.substring(1);
    }

    while (text && TextHelper.isPunctuation(text.charAt(text.length - 1))) {
      text = text.substring(0, text.length - 1);
    }

    return text.trim();
  }

  // 移除开头结尾的阿拉伯数字
  static stripArabicNumerals(text: string): string {
    return text.replace(/^\d+|\d+$/g, '');
  }

  // 移除开头结尾的非日文字符
  static stripNotJapanese(text: string): string {
    text = text.trim();

    while (text && !TextHelper.isJapanese(text.charAt(0))) {
      text = text.substring(1);
    }

    while (text && !TextHelper.isJapanese(text.charAt(text.length - 1))) {
      text = text.substring(0, text.length - 1);
    }

    return text.trim();
  }

  // 移除结尾的汉字字符
  static removeSuffixCJK(text: string): string {
    while (text && TextHelper.isCJK(text.charAt(text.length - 1))) {
      text = text.substring(0, text.length - 1);
    }

    return text;
  }

  // 修复不合规的JSON字符串
  static fixBrokenJsonString(jsonstring: string): string {
    // 移除首尾空白符（含空格、制表符、换行符）
    jsonstring = jsonstring.trim();

    // 移除代码标识
    jsonstring = jsonstring.replace('```json', '').replace('```', '').trim();

    // 补上缺失的 }
    if (!jsonstring.endsWith('}')) {
      jsonstring += '}';
    }

    // 移除多余的 ,
    if (jsonstring.endsWith(',}')) {
      jsonstring = jsonstring.replace(/,}$/, '}');
    }
    if (jsonstring.endsWith(',\n}')) {
      jsonstring = jsonstring.replace(/,\n}$/, '\n}');
    }

    // 移除单行注释
    jsonstring = jsonstring.replace(/\/\/.*(?=,|\s|\}|\n)/g, '').trim();

    // 修正值中错误的单引号
    jsonstring = jsonstring
      .replace(/(?<=:').*?(?=',\n|'$|'\})/gs, (match) =>
        match.replace(/\n/g, '').replace(/\\'/g, "'").replace(/'/g, "\\'"),
      )
      .trim();

    // 修正值中错误的双引号
    jsonstring = jsonstring
      .replace(/(?<=:").*?(?=",\n|"$|"\})/gs, (match) =>
        match.replace(/\n/g, '').replace(/\\"/g, '"').replace(/"/g, '\\"'),
      )
      .trim();

    // 修正错误的全角引号
    jsonstring = jsonstring
      .replace('”,\n', '",\n')
      .replace('”\n}', '"\n}')
      .trim();

    return jsonstring;
  }

  // 按汉字、平假名、片假名拆开日文短语
  static extractJapanese(text: string): string[] {
    const pattern = /[\u4E00-\u9FFF]+|[\u3040-\u309F]+|[\u30A0-\u30FF]+/g;
    const matches = text.match(pattern);
    return matches ? matches : [];
  }

  // 移除开头结尾的非汉字字符
  static stripNotCJK(text: string): string {
    text = text.trim();

    while (text && !TextHelper.isCJK(text.charAt(0))) {
      text = text.substring(1);
    }

    while (text && !TextHelper.isCJK(text.charAt(text.length - 1))) {
      text = text.substring(0, text.length - 1);
    }

    return text.trim();
  }

  // 判断字符是否为拉丁字符
  static isLatin(ch: string): boolean {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return (
      (code >= TextHelper.LATIN_1[0] && code <= TextHelper.LATIN_1[1]) ||
      (code >= TextHelper.LATIN_2[0] && code <= TextHelper.LATIN_2[1]) ||
      (code >= TextHelper.LATIN_EXTENDED_A[0] &&
        code <= TextHelper.LATIN_EXTENDED_A[1]) ||
      (code >= TextHelper.LATIN_EXTENDED_B[0] &&
        code <= TextHelper.LATIN_EXTENDED_B[1]) ||
      (code >= TextHelper.LATIN_PUNCTUATION_SUPPLEMENTAL[0] &&
        code <= TextHelper.LATIN_PUNCTUATION_SUPPLEMENTAL[1])
    );
  }

  // 判断输入的字符串是否全部由拉丁字符组成
  static isAllLatin(text: string): boolean {
    return [...text].every((ch) => TextHelper.isLatin(ch));
  }

  // 检查字符串是否包含至少一个拉丁字符组成
  static hasAnyLatin(text: string): boolean {
    return [...text].some((ch) => TextHelper.isLatin(ch));
  }

  // 移除开头结尾的非拉丁字符
  static stripNotLatin(text: string): string {
    text = text.trim();

    while (text && !TextHelper.isLatin(text.charAt(0))) {
      text = text.substring(1);
    }

    while (text && !TextHelper.isLatin(text.charAt(text.length - 1))) {
      text = text.substring(0, text.length - 1);
    }

    return text.trim();
  }

  // 判断字符是否为韩文字符
  static isKorean(ch: string): boolean {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      return false;
    }
    return (
      (code >= TextHelper.CJK[0] && code <= TextHelper.CJK[1]) ||
      (code >= TextHelper.HANGUL_JAMO[0] &&
        code <= TextHelper.HANGUL_JAMO[1]) ||
      (code >= TextHelper.HANGUL_JAMO_EXTENDED_A[0] &&
        code <= TextHelper.HANGUL_JAMO_EXTENDED_A[1]) ||
      (code >= TextHelper.HANGUL_JAMO_EXTENDED_B[0] &&
        code <= TextHelper.HANGUL_JAMO_EXTENDED_B[1]) ||
      (code >= TextHelper.HANGUL_SYLLABLES[0] &&
        code <= TextHelper.HANGUL_SYLLABLES[1]) ||
      (code >= TextHelper.HANGUL_COMPATIBILITY_JAMO[0] &&
        code <= TextHelper.HANGUL_COMPATIBILITY_JAMO[1])
    );
  }

  // 判断输入的字符串是否全部由韩文字符组成
  static isAllKorean(text: string): boolean {
    return [...text].every((ch) => TextHelper.isKorean(ch));
  }

  // 检查字符串是否包含至少一个韩文字符组成
  static hasAnyKorean(text: string): boolean {
    return [...text].some((ch) => TextHelper.isKorean(ch));
  }

  // 移除开头结尾的非韩文字符
  static stripNotKorean(text: string): string {
    text = text.trim();

    while (text && !TextHelper.isKorean(text.charAt(0))) {
      text = text.substring(1);
    }

    while (text && !TextHelper.isKorean(text.charAt(text.length - 1))) {
      text = text.substring(0, text.length - 1);
    }

    return text.trim();
  }

  static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static isValidJapaneseWord(
    surface: string,
    blacklist: string[] = [],
  ): boolean {
    return (
      surface.length > 1 &&
      !blacklist.includes(surface) &&
      TextHelper.hasAnyJapanese(surface)
    );
  }

  static isValidCJKWord(surface: string, blacklist: string[] = []): boolean {
    return (
      surface.length > 1 &&
      !blacklist.includes(surface) &&
      TextHelper.hasAnyCJK(surface)
    );
  }

  static isValidKoreanWord(surface: string, blacklist: string[] = []): boolean {
    return (
      surface.length > 1 &&
      !blacklist.includes(surface) &&
      TextHelper.hasAnyKorean(surface)
    );
  }

  static isValidEnglishWord(
    surface: string,
    blacklist: string[] = [],
    nerType: string,
    uniqueWords: string[] = [],
  ): boolean {
    if (
      surface.length <= 2 ||
      !TextHelper.hasAnyLatin(surface) ||
      blacklist.includes(surface) ||
      (nerType == NERTYPE.PER && !(surface[0] === surface[0].toUpperCase()))
    ) {
      return false;
    }
    if (uniqueWords !== undefined) {
      const chunks = surface.match(/\b\w+\b/g);
      if (
        chunks &&
        chunks.length > 0 &&
        !chunks.every((chunk) => uniqueWords.includes(chunk))
      ) {
        return false;
      }
    }
    return true;
  }
}
