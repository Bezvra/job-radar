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
    ]
        .filter(Boolean)
        .join('\n')
}

async function call(token: string, method: string, body: unknown) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
            reply_markup: { inline_keyboard: [[{ text: t.telegram.open, url: j.url }]] },
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
