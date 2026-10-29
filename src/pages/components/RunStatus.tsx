import type { RunLog } from '../../services/storage'
import { t } from '../../i18n'
import { ago } from '../utils'

export function RunStatus({ run }: { run: RunLog | null | undefined }) {
    if (!run) return <div class="status">{t.run.never}</div>

    const total = run.results.reduce((a, r) => a + r.count, 0)
    const errors = run.results.filter((r) => !r.ok || r.error)
    return (
        <div class="status">
            {t.run.done(ago(run.at), total)}
            {errors.map((e) => (
                <div key={e.sourceId} class="err">
                    {e.name}: {e.error}
                </div>
            ))}
        </div>
    )
}
