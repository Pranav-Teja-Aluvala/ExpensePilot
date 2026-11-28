import { MAX_FILE_BYTES, parseStatement } from './statement.mjs';

self.onmessage = async ({ data }) => {
  try {
    if (!(data instanceof Blob) || data.size === 0 || data.size > MAX_FILE_BYTES) {
      throw new Error('Choose a non-empty CSV file under 2 MiB.');
    }
    const bytes = await data.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = parseStatement(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    self.postMessage({ ...parsed, fingerprint });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
