export type GenericNovelId =
  | { type: 'web'; providerId: string; novelId: string }
  | { type: 'wenku'; novelId: string }
  | { type: 'local'; volumeId: string };

export const webGnid = (
  providerId: string,
  novelId: string
): GenericNovelId => ({
  type: 'web',
  providerId,
  novelId,
});

export const wenkuGnid = (novelId: string): GenericNovelId => ({
  type: 'wenku',
  novelId,
});

export const localGnid = (volumeId: string): GenericNovelId => ({
  type: 'local',
  volumeId,
});
