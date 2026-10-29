import type { Settings } from '../../core/types'
import { LOCALES, t } from '../../i18n'

/** The interface language: as in the browser, or one of LOCALES (their names in their own language) */
export function LocaleSelect({
    value,
    onChange,
}: {
    value: Settings['locale']
    onChange: (locale: Settings['locale']) => void
}) {
    return (
        <select id="locale" value={value} onChange={(e) => onChange(e.currentTarget.value as Settings['locale'])}>
            <option value="auto">{t.locale.auto}</option>
            {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                    {l.name}
                </option>
            ))}
        </select>
    )
}
