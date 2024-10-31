import { ref } from 'vue';

interface LogEntry {
  id: number;
  type: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'progress';
  rawmessage: string;
  message: string;
}

export class LogHelper {
  private logId = ref(0);
  public logs = ref<LogEntry[]>([]);
  private repeat = ref(1);
  private progressLogId: number | null = null;

  addLog(type: LogEntry['type'], message: string) {
    const lastlog = this.logs.value[this.logs.value.length - 1];

    if (lastlog != undefined) {
      if (message == lastlog.rawmessage) {
        lastlog.message = `${message} [x${++this.repeat.value}]`;
        this.logs.value = [...this.logs.value];
        return;
      }
    }

    this.logs.value.push({
      id: this.logId.value++,
      type,
      rawmessage: message,
      message: `[${type.toUpperCase()}]${message}`,
    });
    this.repeat.value = 1;
  }

  debug(message: string) {
    this.addLog('debug', message);
  }

  info(message: string) {
    this.addLog('info', message);
  }

  warning(message: string) {
    this.addLog('warning', message);
  }

  error(message: string) {
    this.addLog('error', message);
  }

  critical(message: string) {
    this.addLog('critical', message);
  }

  getLogs(): LogEntry[] {
    return this.logs.value;
  }

  clearLogs() {
    this.logs.value = [];
  }

  /**
     純手工進度條
     */
  startProgress(text: string, total: number) {
    // 先把舊的進度條幹掉
    if (this.progressLogId !== null) {
      this.finishProgress();
    }

    const message = `[PROGRESS]${text} [0/${total}]`;
    const progressEntry: LogEntry = {
      id: this.logId.value++,
      type: 'progress',
      rawmessage: text,
      message: message,
    };
    this.logs.value.push(progressEntry);
    this.progressLogId = progressEntry.id;
  }

  //更新進度條
  updateProgress(current: number, total: number) {
    if (this.progressLogId === null) {
      console.warn('Progress bar has not been started.');
      return;
    }

    const progressEntry = this.logs.value.find(
      (entry) => entry.id === this.progressLogId,
    );
    if (progressEntry) {
      progressEntry.message = `[PROGRESS]${progressEntry.rawmessage} [${current}/${total}]`;
      // 為了確保vue當機，重新賦值logs
      this.logs.value = [...this.logs.value];
    }
  }

  //結束進度條
  finishProgress(text?: string) {
    if (this.progressLogId === null) return;

    const progressEntryIndex = this.logs.value.findIndex(
      (entry) => entry.id === this.progressLogId,
    );
    if (progressEntryIndex !== -1) {
      const progressEntry = this.logs.value[progressEntryIndex];
      progressEntry.message = text
        ? `${text} 已完成`
        : `${progressEntry.message} 已完成`;
      // 為了確保vue當機，重新賦值logs
      this.logs.value = [...this.logs.value];
    }
    this.progressLogId = null;
  }
}
