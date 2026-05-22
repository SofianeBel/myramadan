/**
 * startup.js — Small guards for cold-start resilience.
 */

export async function runStartupStep(name, task, fallback = null) {
  try {
    return await task()
  } catch (err) {
    console.warn(`[startup] ${name} failed:`, err)
    return fallback
  }
}

export async function runStartupStepWithTimeout(name, task, timeoutMs, fallback = null) {
  let timeoutId = null
  let timedOut = false

  const taskPromise = Promise.resolve()
    .then(task)
    .catch((err) => {
      if (!timedOut) console.warn(`[startup] ${name} failed:`, err)
      return fallback
    })

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      console.warn(`[startup] ${name} timed out after ${timeoutMs}ms`)
      resolve(fallback)
    }, timeoutMs)
  })

  try {
    return await Promise.race([taskPromise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function revealApp() {
  document.getElementById('splash-screen')?.classList.add('hidden')
  document.querySelector('.app-container')?.classList.add('app-ready')
}
