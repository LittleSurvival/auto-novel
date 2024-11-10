<script lang="ts" setup>
import { ref } from 'vue';
import { DeleteOutlineOutlined, PlusOutlined } from '@vicons/material';
import { UploadCustomRequestOptions, NFlex } from 'naive-ui';
import { VueDraggable } from 'vue-draggable-plus';

import { Locator } from '@/data';
import { Translator, TranslatorConfig } from '@/domain/translate';
import { Glossary } from '@/model/Glossary';
import { useIsWideScreen } from '@/pages/util';
import { getFullContent } from '@/util/file';
import LoadedVolume from './components/LoadedVolume.vue';
import { WGlossary } from '@/model/IGlossary';
import { LogHelper } from './katakanaRewrite/helper/LogHelper';
import { GlossaryGenerator } from './katakanaRewrite/GlossaryGenerator';

const message = useMessage();
const isWideScreen = useIsWideScreen();
const sakuraWorkspace = Locator.sakuraWorkspaceRepository().ref;
const glossaryWorkspace = Locator.glossaryWorkSpaceRepository().ref;

const loadedVolumes = ref<LoadedVolume[]>([]);
const wGlossaryRef = ref<WGlossary>({});
const loggerRef = ref<LogHelper>(new LogHelper());

const selectedGlossaryInfo = ref<{ surface: string; detail: string }>();
const showGlossaryInfoModal = ref(false);
const showGlossaryInfo = (surface: string, detail: string) => {
  selectedGlossaryInfo.value = {
    surface,
    detail,
  };
  showGlossaryInfoModal.value = true;
};

const showSakuraSelectModal = ref(false);
const selectedSakuraWorkerId = ref(sakuraWorkspace.value.workers[0]?.id);
const selectedGlossaryWorker = ref(glossaryWorkspace.value.workers[0]);

const katakanaTranslations = ref<{ [key: string]: string }>({});
const logs = computed(() => loggerRef.value?.logs);

interface LoadedVolume {
  source: 'tmp' | 'local';
  filename: string;
  content: string;
  glossary: WGlossary;
}

const loadGlossary = async () => {
  const logger = new LogHelper();

  loggerRef.value = logger;

  if (loadedVolumes.value.length == 0) {
    logger.error('沒有載入的小說');
    logger.error('結束');
    return;
  }

  try {
    const generator = new GlossaryGenerator(
      selectedGlossaryWorker.value,
      logger,
      [],
    );
    const glossary =
      glossaryWorkspace.value.mode == 'traditional'
        ? await generator.loadKataKanas(
            loadedVolumes.value[0].content,
            glossaryWorkspace.value.traditionalthreshold,
          )
        : await generator.loadGlossary(loadedVolumes.value[0].content);

    wGlossaryRef.value = glossary;
  } catch (ex) {
    logger.error(ex as string);
  }
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
    glossary: {},
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

const katakanaDeleted = ref<string[]>([]);
const undoDeleteKatakana = () => {
  katakanaDeleted.value.pop();
};
const lastDeletedHint = computed(() => {
  const last = katakanaDeleted.value[katakanaDeleted.value.length - 1];
  if (last === undefined) return undefined;
  return `${last} => ${katakanaTranslations.value[last]}`;
});

const copyTranslationJson = async () => {
  const obj = Object.fromEntries(
    Object.keys(wGlossaryRef.value).map((key) => [
      key,
      wGlossaryRef.value[key].zh ?? '',
    ]),
  );
  const jsonString = Glossary.encodeToText(obj);
  await navigator.clipboard.writeText(jsonString);
  message.info('已经将翻译结果复制到剪切板');
};

const translateKatakanas = async (id: 'baidu' | 'youdao' | 'sakura') => {
  const jpWords = Object.keys(wGlossaryRef.value);
  let config: TranslatorConfig;

  if (id === 'sakura') {
    const worker = sakuraWorkspace.value.workers.find(
      (it) => it.id === selectedSakuraWorkerId.value,
    );
    if (!worker) {
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

    jpWords.forEach((jpWord, index) => {
      if (wGlossaryRef.value[jpWord]) {
        wGlossaryRef.value[jpWord].zh = zhWords[index];
      }
    });
  } catch (e: any) {
    message.error(`翻译器错误：${e}`);
  }
};

const showListModal = ref(false);
const dropdownStates = ref<{ [key: number]: boolean }>({});

const toggleDropdown = (index: number) => {
  dropdownStates.value[index] = !dropdownStates.value[index];
};
const selectWorker = (index: number) => {
  glossaryWorkspace.value.currentworker = index;
};

const radioButtonStyle = (isActive: boolean) => ({
  flex: 1,
  textAlign: 'center',
  fontSize: '12px',
  backgroundColor: isActive ? '#008000' : '#000',
  color: '#fff',
});
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

    <c-action-wrapper title="提取器">
      <n-flex vertical spacing="2" style="margin-left: 12px">
        <n-flex align="center">
          <n-button-group size="small">
            <c-button
              label="传统模式"
              :round="false"
              :type="
                glossaryWorkspace.mode === 'traditional' ? 'primary' : 'default'
              "
              @action="glossaryWorkspace.mode = 'traditional'"
            />
            <c-button
              label="AI模式"
              :round="false"
              :type="glossaryWorkspace.mode === 'ai' ? 'primary' : 'default'"
              @action="glossaryWorkspace.mode = 'ai'"
            />
          </n-button-group>
        </n-flex>

        <template v-if="glossaryWorkspace.mode === 'traditional'">
          <n-card shadow="hover" bordered style="padding: auto">
            <n-flex vertical>
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

              <c-action-wrapper title="次数下限" style="margin-bottom: 20px">
                <n-flex align="center">
                  <n-input-number
                    v-model:value="glossaryWorkspace.traditionalthreshold"
                    clearable
                    size="small"
                    style="width: 16em"
                    min="1"
                  />
                </n-flex>
              </c-action-wrapper>

              <c-button
                label="提取术语表"
                size="small"
                :round="false"
                @action="loadGlossary"
                type="success"
              />
            </n-flex>
          </n-card>
        </template>

        <template v-else-if="glossaryWorkspace.mode === 'ai'">
          <!-- Worker Item -->
          <n-list>
            <vue-draggable
              v-model="glossaryWorkspace.workers"
              :animation="150"
              handle=".drag-trigger"
            >
              <n-list-item
                v-for="(worker, index) of glossaryWorkspace.workers"
                :key="index"
                :style="{
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#222',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  color: '#fff',
                  width: '100%',
                }"
              >
                <!-- Worker Header -->
                <div
                  :style="{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    borderRadius: '5px',
                  }"
                >
                  <!-- Drag Handle -->
                  <div
                    class="drag-trigger"
                    :style="{ cursor: 'move', marginRight: '20px' }"
                  >
                    <n-icon> </n-icon>
                  </div>

                  <!-- Select Button -->
                  <n-button
                    @click="selectWorker(index)"
                    :round="true"
                    :style="{
                      backgroundColor:
                        glossaryWorkspace.currentworker === index
                          ? '#008000'
                          : '#000',
                      color: '#fff',
                      fontSize: '12px',
                    }"
                  >
                    {{
                      glossaryWorkspace.currentworker === index
                        ? '已選擇'
                        : '選擇'
                    }}
                  </n-button>

                  <!-- Worker Label -->
                  <div
                    :style="{
                      marginLeft: '10px',
                      fontSize: '12px',
                      flexGrow: 1,
                    }"
                  >
                    {{ `[${worker.apikey}]@${worker.baseurl}` }}
                  </div>

                  <!-- Dropdown Toggle Button -->
                  <n-button
                    @click="toggleDropdown(index)"
                    :round="true"
                    :style="{
                      backgroundColor: '#000',
                      color: '#fff',
                      fontSize: '12px',
                    }"
                  >
                    {{ dropdownStates[index] ? '收起' : '设置' }}
                  </n-button>
                </div>

                <!-- Dropdown Content with Transition -->
                <n-collapse-transition>
                  <div
                    v-if="dropdownStates[index]"
                    :style="{
                      padding: '10px',
                      backgroundColor: '#000',
                      borderRadius: '5px',
                    }"
                  >
                    <!-- Worker Settings Form -->
                    <n-form
                      :model="worker"
                      label-width="auto"
                      :label-style="{ color: '#fff', fontSize: '8px' }"
                      :style="{ color: '#fff', fontSize: '12px' }"
                    >
                      <!-- Type -->
                      <c-action-wrapper title="術語表提取模式">
                        <n-radio-group
                          v-model:value="worker.type"
                          size="small"
                          :style="{ display: 'flex' }"
                        >
                          <n-radio-button
                            value="local"
                            :style="radioButtonStyle(worker.type === 'local')"
                          >
                            local
                          </n-radio-button>
                          <n-radio-button
                            value="api"
                            :style="radioButtonStyle(worker.type === 'api')"
                          >
                            api
                          </n-radio-button>
                        </n-radio-group>
                      </c-action-wrapper>

                      <!-- NER -->
                      <c-action-wrapper title="實體辨識">
                        <n-radio-group
                          v-model:value="worker.ner"
                          size="small"
                          :style="{ display: 'flex' }"
                        >
                          <n-radio-button
                            value="local"
                            :style="radioButtonStyle(worker.ner === 'local')"
                          >
                            Local
                          </n-radio-button>
                          <n-radio-button
                            value="traditional"
                            :style="radioButtonStyle(worker.ner === 'katakana')"
                          >
                            Traditional
                          </n-radio-button>
                          <n-radio-button
                            value="api"
                            :style="radioButtonStyle(worker.ner === 'api')"
                          >
                            API
                          </n-radio-button>
                        </n-radio-group>
                      </c-action-wrapper>

                      <!-- Conditionally Visible Fields -->
                      <template v-if="worker.type !== 'local'">
                        <!-- API Key -->
                        <n-form-item-row label="">
                          API Key
                          <n-input v-model:value="worker.apikey" />
                        </n-form-item-row>
                        <n-form-item label="Model Name">
                          <n-input v-model:value="worker.modelname"></n-input>
                        </n-form-item>
                        <!-- Model Name -->
                      </template>
                      <!-- Base URL -->
                      <n-form-item-row label="Base URL">
                        <n-input v-model:value="worker.baseurl" />
                      </n-form-item-row>
                      <!-- Other Settings -->
                      <!-- Count Threshold -->
                      <n-form-item-row label="Count Threshold">
                        <n-input-number v-model:value="worker.countthreshold" />
                      </n-form-item-row>

                      <!-- Timeout -->
                      <n-form-item-row label="Timeout">
                        <n-input-number v-model:value="worker.timeout" />
                      </n-form-item-row>

                      <!-- Request Frequency -->
                      <n-form-item-row label="Request Frequency">
                        <n-input-number
                          v-model:value="worker.requestfrequency"
                        />
                      </n-form-item-row>

                      <!-- Translate Surface -->
                      <n-form-item-row label="Translate Surface">
                        <n-checkbox v-model:checked="worker.translatesurface" />
                      </n-form-item-row>

                      <!-- Translate Content Per -->
                      <n-form-item-row label="Translate Content Per">
                        <n-checkbox
                          v-model:checked="worker.translatecontentper"
                        />
                      </n-form-item-row>

                      <!-- Translate Content Other -->
                      <n-form-item-row label="Translate Content Other">
                        <n-checkbox
                          v-model:checked="worker.translatecontentother"
                        />
                      </n-form-item-row>
                    </n-form>
                  </div>
                </n-collapse-transition>
              </n-list-item>
            </vue-draggable>
          </n-list>
          <c-button
            label="提取术语表"
            size="small"
            :round="false"
            type="success"
            @action="loadGlossary"
          />
        </template>

        <template v-if="logs && logs.length >= 0">
          <n-h2 style="margin-bottom: 0">日志</n-h2>
          <div
            style="max-height: 300px; overflow-y: auto"
            ref="logContainerRef"
          >
            <div v-for="log in logs" :key="log.id" :class="`log-${log.type}`">
              <n-p>{{ log.message }}</n-p>
            </div>
          </div>
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

    <div v-if="Object.keys(wGlossaryRef).length > 0">
      <n-scrollbar trigger="none" class="max-h-[60vh] max-w-[500px] mt-8">
        <n-table striped size="small" class="text-xs">
          <tbody>
            <tr
              v-for="[jp, { zh, info, count }] in Object.entries(wGlossaryRef)"
              :key="jp"
            >
              <td>
                <n-button
                  text
                  size="small"
                  type="error"
                  @click="katakanaDeleted.push(jp as string)"
                >
                  <template #icon>
                    <n-icon><delete-outline-outlined /></n-icon>
                  </template>
                </n-button>
              </td>
              <td class="whitespace-nowrap">{{ count }}</td>
              <td class="min-w-[40px]">{{ jp }}</td>
              <span
                class="min-w-[20px]"
                @click="showGlossaryInfo(jp, info!!)"
                >{{ '[詳細]' }}</span
              >
              <td class="whitespace-nowrap">=></td>
              <n-input
                v-model:value="wGlossaryRef[jp].zh"
                size="tiny"
                placeholder="请输入中文翻译"
                :theme-overrides="{
                  border: '0',
                  color: 'transparent',
                }"
              />
            </tr>
          </tbody>
        </n-table>
      </n-scrollbar>
    </div>

    <c-modal
      :title="`術語详情 - ${selectedGlossaryInfo?.surface}`"
      v-model:show="showGlossaryInfoModal"
    >
      <n-p style="white-space: pre-wrap">
        {{ selectedGlossaryInfo?.detail }}
      </n-p>
    </c-modal>

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
