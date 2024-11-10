export enum NERTYPE {
  PER = 'PER', //表示人名，如"张三"、"约翰·多伊"等。
  ORG = 'ORG', //表示组织，如"联合国"、"苹果公司"等。
  LOC = 'LOC', //表示地点，通常指非地理政治实体的地点，如"房间"、"街道"等。
  PRD = 'PRD', //表示产品，如"iPhone"、"Windows操作系统"等。
  EVT = 'EVT', //表示事件，如"奥运会"、"地震"等。
  UNKNOWN = 'UNKNOWN', //未知，用於傳統片假名分詞
  EMPTY = '', //用於刪除指定詞語
}

export const NER_TYPES = ['PER', 'ORG', 'LOC', 'PRD', 'EVT'];

export const NERTYPECHINESE: { [key: string]: string } = {
  PER: '角色实体',
  ORG: '组织实体',
  LOC: '地点实体',
  PRD: '物品实体',
  EVT: '事件实体',
};
