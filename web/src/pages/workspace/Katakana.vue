<script lang="ts" setup>
import { DeleteOutlineOutlined, PlusOutlined } from '@vicons/material';
import { UploadCustomRequestOptions } from 'naive-ui';

import { Locator } from '@/data';
import { Translator, TranslatorConfig } from '@/domain/translate';
import { Glossary } from '@/model/Glossary';
import { useIsWideScreen } from '@/pages/util';
import { getFullContent } from '@/util/file';
import LoadedVolume from './components/LoadedVolume.vue';
import { KataKana } from '@/model/Katakana';
import { ref } from 'vue';
import { LogHelper } from './katakana/helper/LogHelper';
import { round } from 'lodash-es';

const message = useMessage();
const isWideScreen = useIsWideScreen();
const sakuraWorkspace = Locator.sakuraWorkspaceRepository().ref;
const katakanaWorkspace = Locator.katakanaWorkSpaceRepository().ref;

const loadedVolumes = ref<LoadedVolume[]>([]);
const katakanasRef = ref<KataKana>({});
const logger = ref<LogHelper>();

const showSakuraSelectModal = ref(false);
const selectedSakuraWorkerId = ref(sakuraWorkspace.value.workers[0]?.id);

const katakanaTranslations = ref<{ [key: string]: string }>({});

const KataKanaModeOptions = [
  { value: 'traditional', label: '传统术语表翻译' },
  { value: 'ai', label: 'AI智能翻译' },
];
const katakanaMode = ref<'traditional' | 'ai'>(katakanaWorkspace.value.mode);

interface LoadedVolume {
  source: 'tmp' | 'local';
  filename: string;
  content: string;
  katakanas: KataKana;
}

const countKatakana = (content: string) => {
  const regexp = /[\u30A0-\u30FF]{2,}/g;
  const matches = content.matchAll(regexp);
  const katakanaCounter: KataKana = {};
  for (const match of matches) {
    const w = match[0];
    if (katakanaCounter[w]) {
      katakanaCounter[w].count++;
    } else {
      katakanaCounter[w] = { count: 1 };
    }
  }
  const sortedKatakanaCounter = Object.fromEntries(
    Object.entries(katakanaCounter).sort(
      ([_w1, c1], [_w2, c2]) => c2.count - c1.count,
    ),
  );
  return sortedKatakanaCounter;
};

const loadVolume = async (
  source: 'tmp' | 'local',
  filename: string,
  file: File,
) => {
  if (
    loadedVolumes.value.find(
      (it) => it.source === source && it.filename === filename,
    ) !== undefined
  ) {
    message.warning('文件已经载入');
    return;
  }

  const content = await getFullContent(file);
  loadedVolumes.value.push({
    source,
    filename,
    content,
    katakanas: countKatakana(content),
  });
};

const deleteVolume = (volume: LoadedVolume) => {
  loadedVolumes.value = loadedVolumes.value.filter(
    (it) => !(it.source === volume.source && it.filename === volume.filename),
  );
};

const loadLocalFile = (volumeId: string) =>
  Locator.localVolumeRepository()
    .then((repo) => repo.getFile(volumeId))
    .then((file) => {
      if (file === undefined) {
        throw '小说不存在';
      }
      return loadVolume('local', volumeId, file.file);
    })
    .catch((error) => message.error(`文件载入失败：${error}`));

const customRequest = ({
  file,
  onFinish,
  onError,
}: UploadCustomRequestOptions) => {
  if (!file.file) return;
  loadVolume('tmp', file.name, file.file)
    .then(onFinish)
    .catch((err) => {
      message.error('文件载入失败:' + err);
      onError();
    });
};

const katakanaThredhold = ref(10);
const logs = computed(() => logger.value?.getLogs());

const katakanaMerged = () => {
  if (loadedVolumes.value.length == 0) {
    katakanasRef.value = {};
  }
  const map: KataKana = {};
  loadedVolumes.value.forEach(({ katakanas }) => {
    Object.entries(katakanas).forEach(([key, value]) => {
      if (!map[key]) {
        map[key] = { count: 0 };
      }
      map[key].count += value.count;
    });
  });
  katakanasRef.value = map;
};

const katakanaDeleted = ref<string[]>([]);
const undoDeleteKatakana = () => {
  katakanaDeleted.value.pop();
};
const lastDeletedHint = computed(() => {
  const last = katakanaDeleted.value[katakanaDeleted.value.length - 1];
  if (last === undefined) return undefined;
  return `${last} => ${katakanaTranslations.value[last]}`;
});

const katakanas = computed(() => {
  if (loadedVolumes.value.length == 0) {
    katakanasRef.value = {};
  }
  return new Map(
    Object.entries(katakanasRef.value).filter(
      ([w, c]) =>
        c.count > katakanaThredhold.value && !katakanaDeleted.value.includes(w),
    ),
  );
});

const copyTranslationJson = async () => {
  const obj = Object.fromEntries(
    Array.from(katakanas.value).map(([key]) => [
      key,
      katakanaTranslations.value[key] ?? '',
    ]),
  );
  const jsonString = Glossary.encodeToText(obj);
  navigator.clipboard.writeText(jsonString);
  message.info('已经将翻译结果复制到剪切板');
};

const translateKatakanas = async (id: 'baidu' | 'youdao' | 'sakura') => {
  const jpWords = [...katakanas.value.keys()];
  let config: TranslatorConfig;
  if (id === 'sakura') {
    const worker = sakuraWorkspace.value.workers.find(
      (it) => it.id === selectedSakuraWorkerId.value,
    );
    if (worker === undefined) {
      message.error('未选择Sakura翻译器');
      return;
    }
    config = {
      id,
      endpoint: worker.endpoint,
      segLength: worker.segLength,
      prevSegLength: worker.prevSegLength,
    };
  } else {
    config = { id };
  }
  try {
    const translator = await Translator.create(config, false);
    const zhWords = await translator.translate(jpWords, {});

    const jpToZh: { [key: string]: string } = {};
    jpWords.forEach((jpWord, index) => {
      jpToZh[jpWord] = zhWords[index];
    });
    katakanaTranslations.value = jpToZh;
  } catch (e: any) {
    message.error(`翻译器错误：${e}`);
  }
};

const showListModal = ref(false);
</script>

<template>
  <c-layout :sidebar="isWideScreen" :sidebar-width="320" class="layout-content">
    <n-h1>术语表工作区</n-h1>

    <bulletin>
      <n-p>术语表辅助制作工具正在开发中，当前方案分为识别和翻译两步。</n-p>
      <n-ul>
        <n-li>识别阶段：根据片假名词汇出现频率判断可能是术语的词汇。</n-li>
        <n-li>翻译阶段：直接翻译日语词汇。</n-li>
      </n-ul>
      <n-p><b>注意，这是辅助制作，不是全自动生成，使用前务必检查结果。</b></n-p>
    </bulletin>

    <c-action-wrapper title="载入文件">
      <n-flex vertical style="margin: 20px 0">
        <n-flex style="margin-bottom: 8px">
          <c-button
            v-if="!isWideScreen"
            label="加载本地小说"
            :icon="PlusOutlined"
            size="small"
            @click="showListModal = true"
            style="margin-right: 10px"
          />
          <div>
            <n-upload
              accept=".txt,.epub,.srt"
              multiple
              directory-dnd
              :custom-request="customRequest"
              :show-file-list="false"
            >
              <c-button
                label="加载文件"
                :icon="PlusOutlined"
                size="small"
                style="margin-right: 10px"
              />
            </n-upload>
          </div>
          <c-button
            label="全部移除"
            :icon="DeleteOutlineOutlined"
            size="small"
            @click="loadedVolumes = []"
          />
        </n-flex>
        <n-text v-for="volume of loadedVolumes">
          <loaded-volume :volume="volume" @delete="deleteVolume(volume)" />
        </n-text>

        <n-text v-if="loadedVolumes.length === 0" depth="3">
          未载入文件
        </n-text>
      </n-flex>
    </c-action-wrapper>

    <c-action-wrapper title="次数下限" style="margin-bottom: 20px">
      <n-flex align="center">
        <n-input-number
          v-model:value="katakanaThredhold"
          clearable
          size="small"
          style="width: 16em"
          min="1"
        />
      </n-flex>
    </c-action-wrapper>

    <c-action-wrapper title="提取器">
      <n-flex vertical spacing="2" style="margin-left: 12px">
        <n-flex align="center">
          <n-button-group size="small">
            <c-button
              label="传统模式"
              :round="false"
              :type="katakanaMode === 'traditional' ? 'primary' : 'default'"
              @action="katakanaMode = 'traditional'"
            />
            <c-button
              label="AI模式"
              :round="false"
              :type="katakanaMode === 'ai' ? 'primary' : 'default'"
              @action="katakanaMode = 'ai'"
            />
          </n-button-group>
        </n-flex>
        <template v-if="katakanaMode === 'traditional'">
          <n-card shadow="hover" bordered style="padding: auto">
            <n-flex vertical spacing="12">
              <n-button-group size="small" style="margin-bottom: 12px">
                <c-button
                  label="百度翻译"
                  :round="false"
                  @action="translateKatakanas('baidu')"
                />
                <c-button
                  label="有道翻译"
                  :round="false"
                  @action="translateKatakanas('youdao')"
                />
                <c-button
                  :label="`Sakura翻译-${selectedSakuraWorkerId ?? '未选中'}`"
                  :round="false"
                  @action="translateKatakanas('sakura')"
                />
                <c-button
                  label="选择Sakura翻译"
                  :round="false"
                  @action="showSakuraSelectModal = true"
                />
              </n-button-group>

              <c-button
                label="提取术语表"
                size="small"
                :round="false"
                @action="katakanaMerged"
                type="success"
              />
            </n-flex>
          </n-card>
        </template>

        <template v-else-if="katakanaMode === 'ai'">
          <n-card shadow="hover">
            <n-flex vertical spacing="2">
              <n-radio-group v-model="katakanaWorkspace.mode" size="small">
                <n-radio label="OpenAI" value="openai" />
                <n-radio label="本地" value="local" />
              </n-radio-group>
              <c-button
                label="提取术语表"
                size="small"
                :round="false"
                type="success"
                @action="katakanaMerged"
              />
              <template v-if="logs && logs.length > 0">
                <n-h2>日志</n-h2>
                <div
                  style="max-height: 300px; overflow-y: auto"
                  ref="logContainerRef"
                >
                  <div
                    v-for="log in logs"
                    :key="log.id"
                    :class="`log-${log.type}`"
                  >
                    <n-p>{{ log.message }}</n-p>
                  </div>
                </div>
              </template>
            </n-flex>
          </n-card>
        </template>
      </n-flex>
    </c-action-wrapper>

    <c-action-wrapper title="操作">
      <n-flex align="left">
        <n-flex align="right" style="margin-left: 24px; margin-top: 10px">
          <c-button
            label="复制术语表"
            size="small"
            :round="false"
            @action="copyTranslationJson()"
            type="primary"
            style="margin: auto"
          />
          <c-button
            :disabled="katakanaDeleted.length === 0"
            label="撤销删除"
            :round="false"
            size="small"
            @action="undoDeleteKatakana"
            style="margin: auto"
            type="error"
          />
          <n-text
            v-if="katakanaDeleted.length > 0"
            depth="3"
            style="font-size: 12px; color: #ff4d4f; margin: 10px"
          >
            {{ lastDeletedHint }}
          </n-text>
        </n-flex>
      </n-flex>
    </c-action-wrapper>

    <n-divider />

    <div v-if="katakanas.size !== 0">
      <n-scrollbar
        trigger="none"
        style="max-height: 60vh; max-width: 500px; margin-top: 30px"
      >
        <n-table striped size="small" style="font-size: 12px">
          <tr v-for="[word, value] in katakanas" :key="word">
            <td>
              <c-icon-button
                tooltip="移除"
                :icon="DeleteOutlineOutlined"
                text
                size="small"
                type="error"
                @action="katakanaDeleted.push(word)"
              />
            </td>
            <td nowrap="nowrap">{{ value.count }}</td>
            <td style="min-width: 100px">{{ word }}</td>
            <td nowrap="nowrap">=></td>
            <td style="padding-right: 16px">
              <n-input
                v-model:value="katakanaTranslations[word]"
                size="tiny"
                placeholder="请输入中文翻译"
                :theme-overrides="{
                  border: '0',
                  color: 'transparent',
                }"
              />
            </td>
          </tr>
        </n-table>
      </n-scrollbar>
    </div>

    <template #sidebar>
      <local-volume-list-katakana @volume-loaded="loadLocalFile" />
    </template>

    <c-drawer-right
      v-if="!isWideScreen"
      v-model:show="showListModal"
      title="本地小说"
    >
      <div style="padding: 24px 16px">
        <local-volume-list-katakana hide-title @volume-loaded="loadLocalFile" />
      </div>
    </c-drawer-right>

    <c-modal title="选择Sakura翻译器" v-model:show="showSakuraSelectModal">
      <n-radio-group v-model:value="selectedSakuraWorkerId">
        <n-flex vertical>
          <n-radio
            v-for="worker of sakuraWorkspace.workers"
            :key="worker.id"
            :value="worker.id"
          >
            {{ worker.id }}
            <n-text depth="3">
              {{ worker.endpoint }}
            </n-text>
          </n-radio>
        </n-flex>
      </n-radio-group>
    </c-modal>
  </c-layout>
</template>
