function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, ...args) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach((cb) => cb(...args));
  }
}

module.exports = { debounce, deepClone, EventEmitter };
