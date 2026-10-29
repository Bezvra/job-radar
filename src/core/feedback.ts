export const REPO_URL = 'https://github.com/Bezvra/job-radar'

/** GitHub fills an issue form's fields from the query; long ones are cut so the URL stays within GitHub's limit */
const MAX_FIELD = 4000

/** A new issue from the templates in .github/ISSUE_TEMPLATE: a bug report with the diagnostics filled in, or an idea */
export function issueUrl(kind: 'bug' | 'idea', diagnostics?: string): string {
    const params = new URLSearchParams({ template: `${kind}.yml` })
    if (diagnostics) params.set('diagnostics', diagnostics.slice(0, MAX_FIELD))
    return `${REPO_URL}/issues/new?${params}`
}
