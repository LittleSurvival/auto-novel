export class PromptHelper {
  static PROMPT_SUMMARIZE_CONTEXT = trimIndent`
          请仔细阅读与关键词"{surface}"相关的内容，然后按照以下步骤进行分析和判断：
  
          分析步骤：
          1、阅读与分析：逐句阅读所有内容，特别关注该词出现的每一个地方，分析该词在句子中的作用、与其他词语的关系以及上下文中的具体含义。
          2、总结相关信息：用中文总结与该词相关的人物关系、剧情背景等，通过这些信息，确定该词在故事中所代表的实体或概念。
          3、根据前几步中的信息，按判断标准判断该词是否指代具体的名字。如果是名字，则继续判断性别。
  
          判断标准：
          1、如果该词是一种称呼，则判断为不是名字。
          2、如果该词是用于描述地点、设施、事件、物品、组织等非人实体的词语，则判断为不是名字。
          3、如果该词是用于描述状态、动作、感情、外貌的词语或其他用于描述属性信息的词语，则判断为不是名字。
          4、如果该词是用于描述职业、头衔、职位、血缘关系的词语或其他用于描述身份信息的词语，则判断为不是名字。
          6、如果按照以上标准依次判断后，依然未能判断为不是名字，则判断为是名字。
  
          相关的内容：
          {context}
  
          回答使用中文，JSON格式，仅需要以下数据，不要出现其他文字或者描述：
          {
          "summary": "<故事总结>",
          "basis": "<简要判断依据>",
          "is_name": "<是/否/未知>",
          "sex": "<男/女/未知>"
          }
      `;

  static PROMPT_TRANSLATE_CONTEXT = trimIndent`
          请认真阅读接收到的与 {surface} 相关的内容。
          然后按以下步骤将其翻译成中文：
          1、理解内容：逐句阅读与理解全部内容，确保在翻译过程中不会断章取义。
          2、逐句翻译：确保翻译的准确性、语境的连贯性和内容的完整性，翻译时保持原文的格式与符号，不要擅自添加原文中没有的代词与符号。
          3、审校润色：联系上下文检查翻译内容，确保正确的使用了人称代词，确保每个句子在其各自的语境中准确连贯，确保整合后的文本在阅读上流畅自然。
  
          相关的内容：
          {context}
  
          回答使用中文，只需列出翻译后的中文译文，不要添加其他的文字、信息、描述或者序号。
      `;

  static PROMPT_TRANSLATE_SURFACE_COMMON = trimIndent`
          将接收到的专有名词翻译成两种不同的中文译文，并使用罗马音标注词语的读音。
  
          专有名词：
          {surface}
  
          回复使用JSON格式，仅需要以下数据，不要出现其他文字或者描述，不要擅自增加条目的数量：
          {
          "translation_1": "<第一种中文译文>",
          "translation_2": "<第二种中文译文>",
          "romaji": "<罗马音>",
          "description": "<翻译说明>"
          }
      `;

  static PROMPT_TRANSLATE_SURFACE_PERSON = trimIndent`
          将接收到的性别为{attribute}的角色的名字翻译成两种不同的中文译文，并使用罗马音标注词语的读音。
  
          角色的名字：
          {surface}
  
          回复使用JSON格式，仅需要以下数据，不要出现其他文字或者描述，不要擅自增加条目的数量：
          {
          "translation_1": "<第一种中文译文，一般为音译>",
          "translation_2": "<第二种中文译文>",
          "romaji": "<罗马音>",
          "description": "<翻译说明>"
          }
      `;
}

function trimIndent(template: TemplateStringsArray, ...substitutions: any[]) {
  let fullString = template.reduce(
    (acc, part, i) => acc + (substitutions[i - 1] || '') + part,
    '',
  );
  const lines = fullString.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  const indentLengths = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^(\s*)/)![1].length);

  const minIndent = indentLengths.length > 0 ? Math.min(...indentLengths) : 0;
  const trimmedLines = lines.map((line) => line.slice(minIndent));
  return trimmedLines.join('\n');
}
