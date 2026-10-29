import { formatSalary } from '../core/salary'
import type { Job, Settings } from '../core/types'
import { t } from '../i18n'

const MAX_PER_RUN = 15

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function formatJob(j: Job): string {
    const pos = j.reasons
        .filter((r) => r.weight > 0)
        .slice(0, 5)
        .map((r) => r.label)
        .join(', ')
    const neg = j.reasons
        .filter((r) => r.weight < 0)
        .map((r) => r.label)
        .join(', ')
    return [
        `<b>${j.score}</b> · <b>${esc(j.title)}</b>`,
        [j.company, j.salary && formatSalary(j.salary)]
            .filter((x) => !!x)
            .map((x) => esc(x as string))
            .join(' · ') || null,
        pos ? `✅ ${esc(pos)}` : null,
        neg ? `⚠️ ${esc(neg)}` : null,
        `<i>${esc(t.telegram.buttonsHint)}</i>`,
    ]
        .filter(Boolean)
        .join('\n')
}

/** The statuses the buttons under a job set, by the letter in their callback data */
const ACTIONS = { s: 'saved', a: 'applied', h: 'hidden' } as const
type Action = keyof typeof ACTIONS

/**
 * A short key for a job id (its URL) in a button's callback data, which Telegram limits to 64 bytes: FNV-1a, 32 bits.
 * The worker finds the job by comparing keys; a collision among a few hundred stored jobs is unlikely
 */
export function jobKey(id: string): string {
    let hash = 0x811c9dc5
    for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193)
    return (hash >>> 0).toString(36)
}

/** The buttons under a job: open it, and save / applied / hide, the current status marked with ✓ */
export function jobKeyboard(j: Pick<Job, 'id' | 'url' | 'status'>) {
    const button = (action: Action) => {
        const status = ACTIONS[action]
        return { text: t.telegram.buttons[status](j.status === status), callback_data: `${action}:${jobKey(j.id)}` }
    }
    return { inline_keyboard: [[{ text: t.telegram.open, url: j.url }], (['s', 'a', 'h'] as Action[]).map(button)] }
}

/** A button press: the status to set and the job's key; null for other data */
export function parseCallback(data: string | undefined): { status: Job['status']; key: string } | null {
    const m = data?.match(/^([sah]):([0-9a-z]+)$/)
    return m ? { status: ACTIONS[m[1] as Action], key: m[2] } : null
}

async function call(token: string, method: string, body: unknown, signal?: AbortSignal) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.description ?? `HTTP ${res.status}`)
    return data
}

export async function sendJobs(jobs: Job[], settings: Settings): Promise<number> {
    const { enabled, botToken, chatId } = settings.telegram
    if (!enabled || !botToken || !chatId || !jobs.length) return 0

    const top = [...jobs].sort((a, b) => b.score - a.score).slice(0, MAX_PER_RUN)
    for (const j of top) {
        await call(botToken, 'sendMessage', {
            chat_id: chatId,
            text: formatJob(j),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: jobKeyboard(j),
        })
        await new Promise((r) => setTimeout(r, 400))
    }
    if (jobs.length > top.length) {
        await call(botToken, 'sendMessage', {
            chat_id: chatId,
            text: t.telegram.more(jobs.length - top.length),
        })
    }
    return top.length
}

export async function sendTest(settings: Settings): Promise<void> {
    const { botToken, chatId } = settings.telegram
    await call(botToken, 'sendMessage', { chat_id: chatId, text: t.telegram.connected })
}

export interface TelegramUpdate {
    update_id: number
    callback_query?: {
        id: string
        data?: string
        message?: { message_id: number; chat: { id: number } }
    }
}

/**
 * Long polling: waits up to `wait` seconds for updates after `offset` (which confirms the ones before it). Keep it under
 * 30: Chrome stops an extension's worker whose fetch response takes longer than that
 */
export async function getUpdates(token: string, offset: number, wait = 25): Promise<TelegramUpdate[]> {
    const data = await call(token, 'getUpdates', { offset, timeout: wait }, AbortSignal.timeout((wait + 15) * 1000))
    return data.result
}

/** The small notice Telegram shows after a button press. Fails for a press older than a few minutes, which is fine */
export const answerCallback = (token: string, id: string, text: string) =>
    call(token, 'answerCallbackQuery', { callback_query_id: id, text }).catch(() => undefined)

/** The job's buttons redrawn for its new status */
export const updateKeyboard = (token: string, chatId: number, messageId: number, job: Job) =>
    call(token, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: jobKeyboard(job),
    }).catch(() => undefined)
