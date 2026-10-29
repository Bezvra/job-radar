/** Details from a job page's schema.org JobPosting (JSON-LD). Djinni's RSS has no company, but its job pages do. */
export function parseJobPosting(html: string): { company: string } | null {
    for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
            const posting = [JSON.parse(json)].flat().find((d) => d?.['@type'] === 'JobPosting')
            const company = posting?.hiringOrganization?.name?.trim()
            if (company) return { company }
        } catch {
            // malformed block, try the next one
        }
    }
    return null
}
