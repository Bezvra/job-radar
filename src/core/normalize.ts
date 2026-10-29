import type { RawItem } from './types'

export interface Normalized {
    id: string
    title: string
    company: string
    url: string
    description: string
    publishedAt: string | null
}

/**
 * DOU titles look like "Senior Front-end Developer в Company, Київ, віддалено".
 * Djinni titles are usually plain; company may come from dc:creator/author or "at Company".
 */
export function splitTitle(raw: string, author: string | null): { title: string; company: string; location?: string } {
    const dou = raw.match(/^(.*?)\s+в\s+([^,]+?)(?:,\s*(.*))?$/)
    if (dou && dou[1].length > 3) {
        const r: { title: string; company: string; location?: string } = {
            title: dou[1].trim(),
            company: dou[2].trim(),
        }
        if (dou[3]) r.location = dou[3].trim()
        return r
    }
    const at = raw.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i)
    if (at) return { title: at[1].trim(), company: at[2].trim() }
    return { title: raw.trim(), company: (author ?? '').trim() }
}

function canonicalUrl(link: string): string {
    try {
        const u = new URL(link)
        u.search = ''
        u.hash = ''
        return u.toString().replace(/\/$/, '')
    } catch {
        return link
    }
}

export function dedupeKey(title: string, company: string): string {
    const n = (s: string) =>
        s
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim()
    return `${n(title)}|${n(company)}`
}

export function normalize(item: RawItem): Normalized {
    const { title, company, location } = splitTitle(item.title, item.author)
    const url = canonicalUrl(item.link)
    const date = item.pubDate ? new Date(item.pubDate) : null
    return {
        id: url,
        title,
        company,
        url,
        description: ((location ? `Локація: ${location}\n` : '') + item.description).slice(0, 4000),
        publishedAt: date && !isNaN(date.getTime()) ? date.toISOString() : null,
    }
}
