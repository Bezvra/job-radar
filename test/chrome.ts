/**
 * Just enough of `chrome.*` and `fetch` to run the service worker (src/background.ts) under Node: storage in memory,
 * alarms as plain records, and the listeners it registers kept so a test can fire them
 */
type Listener = (...args: any[]) => unknown

export const store: Record<string, unknown> = {}
export const alarms = new Map<string, chrome.alarms.Alarm>()
export const listeners: Record<string, Listener> = {}
export const notifications: string[] = []
export const fetched: string[] = []
/** Bodies of POST requests (the Telegram API), in order */
export const posted: { url: string; body: any }[] = []
/** URL → response body, or a function of the POST body making it; a URL missing here gets a 404 */
export const responses = new Map<string, string | ((body: any) => string)>()

const on = (name: string) => ({ addListener: (fn: Listener) => (listeners[name] = fn) })

const fakeChrome = {
    storage: {
        local: {
            get: async (keys: string | string[]) =>
                Object.fromEntries([keys].flat().map((k) => [k, structuredClone(store[k])])),
            set: async (items: Record<string, unknown>) => void Object.assign(store, structuredClone(items)),
        },
    },
    alarms: {
        get: async (name: string) => alarms.get(name),
        clear: async (name: string) => alarms.delete(name),
        create: async (name: string, info: { delayInMinutes: number; periodInMinutes?: number }) =>
            void alarms.set(name, {
                name,
                scheduledTime: Date.now() + info.delayInMinutes * 60_000,
                periodInMinutes: info.periodInMinutes,
                persistAcrossSessions: true,
            }),
        onAlarm: on('alarm'),
    },
    runtime: {
        onInstalled: on('installed'),
        onStartup: on('startup'),
        onMessage: on('message'),
        getPlatformInfo: async () => ({}),
        getURL: (path: string) => `chrome-extension://test/${path}`,
        OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' },
    },
    notifications: {
        create: (options: { message: string }) => void notifications.push(options.message),
        onClicked: on('notificationClicked'),
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { create: async () => {} },
}

Object.assign(globalThis, { chrome: fakeChrome })

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    fetched.push(url)
    const sent = init?.body ? JSON.parse(String(init.body)) : undefined
    if (sent) posted.push({ url, body: sent })
    const response = responses.get(url)
    const body = typeof response === 'function' ? response(sent) : response
    return new Response(body ?? '', { status: body === undefined ? 404 : 200 })
}) as typeof fetch

// The worker pauses between requests to be polite (1.5s, 0.7s); not needed against fake responses
const realSetTimeout = globalThis.setTimeout
globalThis.setTimeout = ((fn: () => void, _ms?: number) => realSetTimeout(fn, 0)) as typeof setTimeout

/** Sends a message the way a page does and resolves with the worker's reply */
export const send = (msg: object) =>
    new Promise<any>((resolve) => {
        const async = listeners.message(msg, {}, resolve)
        if (async !== true) resolve(undefined)
    })

export function reset(): void {
    for (const key of Object.keys(store)) delete store[key]
    alarms.clear()
    responses.clear()
    fetched.length = 0
    posted.length = 0
    notifications.length = 0
}
