const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Registers the generated service worker only when secure context requirements are met.
 * HTTP deployments continue as reduced web apps without service-worker features.
 */
export function registerServiceWorkerForSecureContextsOnly() {
  if (!import.meta.env.PROD) {
    return
  }

  if (!('serviceWorker' in navigator)) {
    return
  }

  const isSecureRuntime = window.isSecureContext || LOCALHOST_HOSTNAMES.has(window.location.hostname)
  if (!isSecureRuntime) {
    return
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch((error) => {
        console.error('Service worker registration failed.', error)
      })
  })
}
