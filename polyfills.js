// Polyfill for BroadcastChannel in Node.js/Wrangler local environment
if (typeof globalThis.BroadcastChannel === 'undefined') {
  class BroadcastChannelPolyfill extends EventTarget {
    constructor(name) {
      super();
      this.name = name;
      this._closed = false;
      
      // Store static channels for cross-instance communication
      if (!globalThis._broadcastChannels) {
        globalThis._broadcastChannels = new Map();
      }
      
      if (!globalThis._broadcastChannels.has(name)) {
        globalThis._broadcastChannels.set(name, new Set());
      }
      
      globalThis._broadcastChannels.get(name).add(this);
    }
    
    postMessage(data) {
      if (this._closed) return;
      
      const event = new MessageEvent('message', {
        data: structuredClone ? structuredClone(data) : data,
        origin: globalThis.location?.origin || 'http://localhost'
      });
      
      // Send to all channels with the same name
      const channels = globalThis._broadcastChannels.get(this.name);
      if (channels) {
        channels.forEach(channel => {
          if (channel !== this && !channel._closed) {
            // Use setTimeout to make it async like the real API
            setTimeout(() => {
              channel.dispatchEvent(event);
            }, 0);
          }
        });
      }
    }
    
    close() {
      this._closed = true;
      const channels = globalThis._broadcastChannels.get(this.name);
      if (channels) {
        channels.delete(this);
        if (channels.size === 0) {
          globalThis._broadcastChannels.delete(this.name);
        }
      }
    }
    
    addEventListener(type, listener, options) {
      super.addEventListener(type, listener, options);
    }
    
    removeEventListener(type, listener, options) {
      super.removeEventListener(type, listener, options);
    }
  }
  
  globalThis.BroadcastChannel = BroadcastChannelPolyfill;
}

// Also provide a simple MessageEvent polyfill if needed
if (typeof globalThis.MessageEvent === 'undefined') {
  globalThis.MessageEvent = class MessageEvent extends Event {
    constructor(type, eventInitDict = {}) {
      super(type, eventInitDict);
      this.data = eventInitDict.data;
      this.origin = eventInitDict.origin || '';
      this.source = eventInitDict.source || null;
    }
  };
}