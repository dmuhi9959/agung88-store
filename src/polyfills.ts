// Polyfills untuk support Android WebView lama (Android 5-9)

// Array.includes polyfill
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement: any, fromIndex: number) {
      if (this == null) { throw new TypeError('"this" is null or not defined'); }
      var o = Object(this);
      var len = o.length >>> 0;
      if (len === 0) { return false; }
      var n = fromIndex | 0;
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      function sameValueZero(x: any, y: any) { return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y)); }
      while (k < len) { if (sameValueZero(o[k], searchElement)) { return true; } k++; }
      return false;
    }
  });
}

// String.includes polyfill
if (!String.prototype.includes) {
  String.prototype.includes = function(search: string, start?: number) {
    if (typeof start !== 'number') { start = 0; }
    if (start + search.length > this.length) { return false; }
    return this.indexOf(search, start) !== -1;
  } as any;
}

// String.startsWith polyfill
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(search: string, pos?: number) {
    pos = !pos || pos < 0 ? 0 : +pos;
    return this.substring(pos, pos + search.length) === search;
  } as any;
}

// Object.assign polyfill
if (typeof Object.assign !== 'function') {
  Object.assign = function(target: any) {
    if (target == null) { throw new TypeError('Cannot convert undefined or null to object'); }
    target = Object(target);
    for (var index = 1; index < arguments.length; index++) {
      var source = arguments[index];
      if (source != null) {
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
    }
    return target;
  };
}

// Promise polyfill (kalau gak ada)
if (typeof Promise === 'undefined') {
  // Load Promise polyfill
  var P = function(executor: any) {
    var self = this;
    self.state = 'pending';
    self.value = undefined;
    self.callbacks = [];
    function resolve(value: any) {
      if (self.state === 'pending') { self.state = 'fulfilled'; self.value = value; self.callbacks.forEach(function(cb: any) { cb.onFulfilled(value); }); }
    }
    function reject(reason: any) {
      if (self.state === 'pending') { self.state = 'rejected'; self.value = reason; self.callbacks.forEach(function(cb: any) { cb.onRejected(reason); }); }
    }
    try { executor(resolve, reject); } catch (e) { reject(e); }
  };
  (P as any).prototype.then = function(onFulfilled: any, onRejected: any) {
    var self = this;
    return new P(function(resolve: any, reject: any) {
      function handleCallback(cb: any, value: any, resolve: any, reject: any) {
        try { var result = cb(value); resolve(result); } catch (e) { reject(e); }
      }
      if (self.state === 'fulfilled') { if (onFulfilled) { handleCallback(onFulfilled, self.value, resolve, reject); } else { resolve(self.value); } }
      else if (self.state === 'rejected') { if (onRejected) { handleCallback(onRejected, self.value, resolve, reject); } else { reject(self.value); } }
      else { self.callbacks.push({ onFulfilled: function(v: any) { if (onFulfilled) { handleCallback(onFulfilled, v, resolve, reject); } else { resolve(v); } }, onRejected: function(r: any) { if (onRejected) { handleCallback(onRejected, r, resolve, reject); } else { reject(r); } } }); }
    });
  };
  (P as any).resolve = function(value: any) { return new P(function(resolve: any) { resolve(value); }); };
  (P as any).reject = function(reason: any) { return new P(function(resolve: any, reject: any) { reject(reason); }); };
  (window as any).Promise = P;
}

// fetch polyfill (kalau gak ada)
if (typeof fetch === 'undefined') {
  (window as any).fetch = function(url: string, options: any) {
    options = options || {};
    return new Promise(function(resolve: any, reject: any) {
      var xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url);
      if (options.headers) {
        for (var key in options.headers) { xhr.setRequestHeader(key, options.headers[key]); }
      }
      xhr.onload = function() {
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText, text: function() { return Promise.resolve(xhr.responseText); }, json: function() { return Promise.resolve(JSON.parse(xhr.responseText)); }, headers: { get: function(name: string) { return xhr.getResponseHeader(name); } } });
      };
      xhr.onerror = function() { reject(new TypeError('Network request failed')); };
      xhr.send(options.body);
    });
  };
}

// Array.from polyfill
if (!Array.from) {
  Array.from = function(iterable: any) {
    var arr: any[] = [];
    for (var i = 0; i < iterable.length; i++) { arr.push(iterable[i]); }
    return arr;
  } as any;
}

// Array.find polyfill
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate: any) {
      if (this == null) { throw new TypeError('this is null or not defined'); }
      var o = Object(this);
      var len = o.length >>> 0;
      for (var k = 0; k < len; k++) { var kValue = o[k]; if (predicate.call(undefined, kValue, k, o)) { return kValue; } }
      return undefined;
    }
  });
}

// Array.filter polyfill
if (!Array.prototype.filter) {
  Array.prototype.filter = function(func: any) {
    var arr: any[] = [];
    for (var i = 0; i < this.length; i++) { if (func(this[i], i, this)) { arr.push(this[i]); } }
    return arr;
  } as any;
}

// Array.map polyfill
if (!Array.prototype.map) {
  Array.prototype.map = function(func: any) {
    var arr: any[] = [];
    for (var i = 0; i < this.length; i++) { arr.push(func(this[i], i, this)); }
    return arr;
  } as any;
}

// console.warn polyfill (kalau gak ada)
if (typeof console === 'undefined') {
  (window as any).console = { log: function() {}, warn: function() {}, error: function() {} };
}

console.log('[polyfills] ES5 polyfills loaded');
