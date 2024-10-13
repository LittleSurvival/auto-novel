import { ref } from 'vue';

interface LogEntry {
  id: number;
  type: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

export class LogHelper {
  private logId = 0;
  public logs = ref<LogEntry[]>([]);

  addLog(type: LogEntry['type'], message: string) {
    this.logs.value.push({ id: this.logId++, type, message });
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
}
