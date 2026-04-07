/**
 * Setup para testes — configura fake-indexeddb para simular
 * IndexedDB em ambiente de teste Node.js
 */
import 'fake-indexeddb/auto';

// Polyfill para crypto.randomUUID em ambiente de teste
if (!globalThis.crypto?.randomUUID) {
  const { randomUUID } = await import('crypto');
  globalThis.crypto = { ...globalThis.crypto, randomUUID };
}

// Polyfill para BroadcastChannel (não existe no Node.js)
if (!globalThis.BroadcastChannel) {
  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor() {
      this.listeners = [];
    }
    postMessage() {}
    addEventListener(_, handler) {
      this.listeners.push(handler);
    }
    removeEventListener(_, handler) {
      this.listeners = this.listeners.filter((h) => h !== handler);
    }
    close() {}
  };
}

