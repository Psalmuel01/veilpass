// midnight-js-http-client-proof-provider captures `fetch` at module load:
//
//   const fetchRetry = fetchBuilder(fetch, retryOptions);
//
// That detaches it from `window`, and calling it later throws
// "Failed to execute 'fetch' on 'Window': Illegal invocation" in the browser.
// Node has no such binding requirement, so the same code proves fine there.
//
// Rebinding the global before that module is imported makes the captured
// reference safe to call. Import this first, for its side effect.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  window.fetch = window.fetch.bind(window);
}

export {};
