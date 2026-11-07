/**
 * Details from a job page's schema.org JobPosting (JSON-LD). Djinni's RSS has no company and doesn't say whether a job
 * is remote, but its job pages do (`jobLocationType: TELECOMMUTE`).
 */
export function parseJobPosting(html: string): { company: string; remote: boolean } | null {
    for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
            const posting = [JSON.parse(json)].flat().find((d) => d?.['@type'] === 'JobPosting')
            const company = posting?.hiringOrganization?.name?.trim()
            if (company) return { company, remote: [posting.jobLocationType].flat().includes('TELECOMMUTE') }
        } catch {
            // malformed block, try the next one
        }
    }
    return null
}

const REMOTE_LINE = '\nRemote'

/**
 * The description with the page's remote flag as a last line, so the remote rule sees it. At the end, since the start
 * is where findSalary trusts a bare amount; added once
 */
export const withRemote = (description: string) =>
    description.endsWith(REMOTE_LINE) ? description : description + REMOTE_LINE
