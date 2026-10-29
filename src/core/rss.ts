import type { RawItem } from './types'

// MV3 service workers have no DOMParser, so this is a small, tolerant RSS parser.

const ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    laquo: '«',
    raquo: '»',
    mdash: '—',
    ndash: '–',
    hellip: '…',
    rsquo: '’',
    lsquo: '‘',
}

export function decodeEntities(s: string): string {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
        if (e[0] === '#') {
            const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
            return Number.isFinite(code) ? String.fromCodePoint(code) : m
        }
        return ENTITIES[e.toLowerCase()] ?? m
    })
}

function unwrap(raw: string): string {
    const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
    return cdata ? cdata[1] : decodeEntities(raw)
}

export function stripHtml(html: string): string {
    return decodeEntities(
        html
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, '\n')
            .replace(/<[^>]+>/g, ' '),
    )
        .replace(/[ \t ]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim()
}

function tag(block: string, name: string): string | null {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')
    const m = block.match(re)
    return m ? unwrap(m[1]).trim() : null
}

function tags(block: string, name: string): string[] {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'gi')
    return [...block.matchAll(re)].map((m) => unwrap(m[1]).trim()).filter(Boolean)
}

export function parseRss(xml: string): RawItem[] {
    const blocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1])
    return blocks
        .map((b) => ({
            title: stripHtml(tag(b, 'title') ?? ''),
            link: (tag(b, 'link') ?? tag(b, 'guid') ?? '').trim(),
            description: stripHtml(tag(b, 'description') ?? tag(b, 'content:encoded') ?? ''),
            pubDate: tag(b, 'pubDate'),
            author: tag(b, 'dc:creator') ?? tag(b, 'author'),
            categories: tags(b, 'category'),
        }))
        .filter((i) => i.title && i.link)
}
