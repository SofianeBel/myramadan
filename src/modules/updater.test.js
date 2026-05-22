import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}))

vi.mock('./platform.js', () => ({
  isMobile: false,
}))

vi.mock('./storage.js')

const STARTUP_DELAY = 3 * 1000
const AUTO_CHECK_INTERVAL = 4 * 60 * 60 * 1000

function setupUpdaterDom() {
  document.body.innerHTML = `
    <a href="#" id="updater-btn"><span id="updater-badge" style="display: none;">NEW</span></a>
    <div id="updater-modal" class="hidden">
      <div id="updater-state-checking"></div>
      <div id="updater-state-ready" class="hidden"></div>
      <div id="updater-state-error" class="hidden"></div>
      <div id="updater-state-uptodate" class="hidden"></div>
      <div id="updater-progress-fill"></div>
      <div id="updater-progress-text"></div>
      <div id="updater-version"></div>
      <div id="updater-notes"></div>
      <div id="updater-error-msg"></div>
      <button id="updater-close"></button>
      <button id="updater-install-btn"></button>
      <button id="updater-later-btn"></button>
      <button id="updater-retry-btn"></button>
      <button id="updater-close-error"></button>
      <button id="updater-close-uptodate"></button>
    </div>
  `
}

function makeUpdate(version = '1.9.0') {
  return {
    version,
    body: 'Notes de version',
    download: vi.fn(async (onEvent) => {
      onEvent({ event: 'Started', data: { contentLength: 10 } })
      onEvent({ event: 'Finished', data: {} })
    }),
    install: vi.fn(),
  }
}

async function loadUpdater() {
  vi.resetModules()
  const updater = await import('./updater.js')
  const updaterPlugin = await import('@tauri-apps/plugin-updater')
  const notifications = await import('@tauri-apps/plugin-notification')
  const storage = await import('./storage.js')
  updaterPlugin.check.mockReset()
  notifications.isPermissionGranted.mockReset()
  notifications.requestPermission.mockReset()
  notifications.sendNotification.mockReset()
  return { updater, updaterPlugin, notifications, storage: storage.default }
}

describe('updater', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      callback()
      return 1
    })
    setupUpdaterDom()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('runs a startup check and treats a Tauri v2 Update object as available', async () => {
    const { updater, updaterPlugin, notifications, storage } = await loadUpdater()
    const update = makeUpdate()
    storage._reset()
    updaterPlugin.check.mockResolvedValue(update)
    notifications.isPermissionGranted.mockResolvedValue(true)

    await updater.initUpdater()
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY)

    expect(updaterPlugin.check).toHaveBeenCalledTimes(1)
    expect(update.download).toHaveBeenCalledTimes(1)
    expect(document.getElementById('updater-badge').style.display).toBe('')
    expect(document.getElementById('updater-version').textContent).toBe('v1.9.0')
    expect(document.getElementById('updater-state-ready').classList.contains('hidden')).toBe(false)
    expect(document.getElementById('updater-toast')).not.toBeNull()
    expect(notifications.sendNotification).toHaveBeenCalledWith({
      title: 'Mise à jour GuideME disponible',
      body: 'La version 1.9.0 est prête à installer.',
    })
  })

  it('checks again on the periodic interval', async () => {
    const { updater, updaterPlugin, storage } = await loadUpdater()
    storage._reset()
    updaterPlugin.check.mockResolvedValue(null)

    await updater.initUpdater()
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY)
    await vi.advanceTimersByTimeAsync(AUTO_CHECK_INTERVAL)

    expect(updaterPlugin.check).toHaveBeenCalledTimes(2)
    expect(document.getElementById('updater-badge').style.display).toBe('none')
  })

  it('opens the ready state without rechecking when an update is already pending', async () => {
    const { updater, updaterPlugin, notifications, storage } = await loadUpdater()
    const update = makeUpdate()
    storage._reset()
    updaterPlugin.check.mockResolvedValue(update)
    notifications.isPermissionGranted.mockResolvedValue(true)

    await updater.initUpdater()
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY)

    document.getElementById('updater-btn').click()

    expect(updaterPlugin.check).toHaveBeenCalledTimes(1)
    expect(document.getElementById('updater-modal').classList.contains('hidden')).toBe(false)
    expect(document.getElementById('updater-state-ready').classList.contains('hidden')).toBe(false)
  })

  it('clears the pending update when the user chooses later', async () => {
    const { updater, updaterPlugin, notifications, storage } = await loadUpdater()
    const update = makeUpdate()
    storage._reset()
    updaterPlugin.check.mockResolvedValue(update)
    notifications.isPermissionGranted.mockResolvedValue(true)

    await updater.initUpdater()
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY)

    document.getElementById('updater-later-btn').click()
    expect(storage.get('updater_dismissedVersion')).toBe('1.9.0')
    expect(document.getElementById('updater-badge').style.display).toBe('none')
    expect(document.getElementById('updater-toast')).toBeNull()

    document.getElementById('updater-btn').click()
    await vi.advanceTimersByTimeAsync(600)

    expect(updaterPlugin.check).toHaveBeenCalledTimes(2)
  })

  it('does not notify again for a dismissed version', async () => {
    const { updater, updaterPlugin, notifications, storage } = await loadUpdater()
    const update = makeUpdate()
    storage._reset()
    storage.set('updater_dismissedVersion', '1.9.0')
    updaterPlugin.check.mockResolvedValue(update)

    await updater.initUpdater()
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY)

    expect(update.download).not.toHaveBeenCalled()
    expect(document.getElementById('updater-badge').style.display).toBe('none')
    expect(notifications.sendNotification).not.toHaveBeenCalled()
  })
})
