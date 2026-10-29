import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { belowMinSalary, formatSalary } from '../../core/salary'
import type { Job, JobStatus, Settings } from '../../core/types'
import { ago, formatWeight, PLATFORMS, platformLabel, platformsOf, sourceNames } from '../utils'
import { t } from '../../i18n'
import { LinkChooser } from './LinkChooser'

interface Props {
    job: Job
    settings: Settings
    onStatus: (job: Job, status: JobStatus) => void
}

export function JobCard({ job, settings, onStatus }: Props) {
    const level = job.score >= settings.applyThreshold ? 'good' : job.score >= settings.hideBelow ? 'mid' : 'bad'
    const underpaid = belowMinSalary(job.salary, settings.minSalary)
    const [choosing, setChoosing] = useState(false)
    const urls = [job.url, ...(job.alternates ?? [])]
    const platforms = platformsOf(job, settings)
    const markSeen = () => job.status === 'new' && onStatus(job, 'seen')
    const meta = [
        job.company,
        job.salary && (
            <span
                class={`salary${underpaid ? ' low' : ''}`}
                title={underpaid ? t.card.underpaid(settings.minSalary) : t.card.salary}
            >
                {formatSalary(job.salary)}
            </span>
        ),
        ago(job.publishedAt ?? job.firstSeen),
        platforms.length
            ? platforms.map((id) => PLATFORMS.find((p) => p.id === id)!.label).join(' / ')
            : // Saved from the popup: no source, so the site it's on
              sourceNames(job, settings) || platformLabel(job.url),
    ].filter(Boolean)

    return (
        <article class={`job${job.status === 'new' ? ' is-new' : ''}`}>
            <div class={`score ${level}`} title={t.common.score}>
                {job.score}
            </div>
            <div>
                <a
                    class="title"
                    href={job.url}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => {
                        // Several copies: ask which to open (Ctrl/Cmd-click still opens the first one directly)
                        if (urls.length > 1 && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault()
                            setChoosing(true)
                        } else markSeen()
                    }}
                >
                    {job.title}
                </a>
                {choosing && (
                    <LinkChooser title={job.title} urls={urls} onOpen={markSeen} onClose={() => setChoosing(false)} />
                )}
                {job.status === 'new' && (
                    <span class="new-badge" title={t.card.newTitle}>
                        {t.card.new}
                    </span>
                )}
                <div class="meta">
                    {meta.map((part, i) => (
                        <Fragment key={i}>
                            {i > 0 && ' · '}
                            {part}
                        </Fragment>
                    ))}
                </div>
                <div class="chips">
                    {job.reasons.map((r) => (
                        <span key={r.label} class={`chip ${r.weight >= 0 ? 'pos' : 'neg'}`}>
                            {formatWeight(r.weight)} {r.label}
                        </span>
                    ))}
                    {job.neutral?.map((name) => (
                        <span key={name} class="chip neutral" title={t.common.neutralTech}>
                            {name}
                        </span>
                    ))}
                </div>
                <div class="desc">{job.description}</div>
                <div class="actions">
                    {job.status !== 'saved' && <button onClick={() => onStatus(job, 'saved')}>{t.common.save}</button>}
                    {job.status !== 'applied' && (
                        <button onClick={() => onStatus(job, 'applied')}>{t.common.applied}</button>
                    )}
                    {job.status !== 'hidden' ? (
                        <button onClick={() => onStatus(job, 'hidden')}>{t.common.hide}</button>
                    ) : (
                        <button onClick={() => onStatus(job, 'seen')}>{t.common.restore}</button>
                    )}
                </div>
            </div>
        </article>
    )
}
