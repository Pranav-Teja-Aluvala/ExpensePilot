const MAX_MEMORY_LOGS = 500;
const MAX_PERSISTED_ERRORS = 100;
const ERROR_LOG_KEY = 'ep_error_log';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class LogBuffer {
  constructor(maxSize) {
    this.buffer = new Array(maxSize);
    this.maxSize = maxSize;
    this.head = 0;
    this.count = 0;
  }

  push(entry) {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) this.count++;
  }

  getAll() {
    if (this.count < this.maxSize) return this.buffer.slice(0, this.count);
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }

  clear() {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.count = 0;
  }
}

const logBuffer = new LogBuffer(MAX_MEMORY_LOGS);
let currentLevel = LEVELS.info;

function createEntry(level, module, message, data) {
  return {
    timestamp: new Date().toISOString(),
    level,
    module: module || 'app',
    message,
    data: data !== undefined ? data : undefined,
  };
}

async function persistError(entry) {
  try {
    const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    if (!isExt) return;
    chrome.storage.local.get([ERROR_LOG_KEY], (result) => {
      const errors = result[ERROR_LOG_KEY] || [];
      errors.push(entry);
      while (errors.length > MAX_PERSISTED_ERRORS) errors.shift();
      chrome.storage.local.set({ [ERROR_LOG_KEY]: errors });
    });
  } catch { }
}

export const Logger = {
  debug(module, message, data) {
    if (currentLevel > LEVELS.debug) return;
    const entry = createEntry('debug', module, message, data);
    logBuffer.push(entry);
    console.debug(`[EP:${module}]`, message, data !== undefined ? data : '');
  },

  info(module, message, data) {
    if (currentLevel > LEVELS.info) return;
    const entry = createEntry('info', module, message, data);
    logBuffer.push(entry);
    console.info(`[EP:${module}]`, message, data !== undefined ? data : '');
  },

  warn(module, message, data) {
    if (currentLevel > LEVELS.warn) return;
    const entry = createEntry('warn', module, message, data);
    logBuffer.push(entry);
    console.warn(`[EP:${module}]`, message, data !== undefined ? data : '');
  },

  error(module, message, data) {
    const entry = createEntry('error', module, message, data);
    logBuffer.push(entry);
    persistError(entry);
    console.error(`[EP:${module}]`, message, data !== undefined ? data : '');
  },

  getRecentLogs(count = 50) {
    const all = logBuffer.getAll();
    return all.slice(-count);
  },

  clearLogs() {
    logBuffer.clear();
  },

  setLevel(level) {
    if (LEVELS[level] !== undefined) currentLevel = LEVELS[level];
  }
};
