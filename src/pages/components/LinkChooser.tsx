import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../i18n'
import { platformLabel } from '../utils'

interface Props {
    title: string
    urls: string[]
    onOpen: () => void
    onClose: () => void
}

/** The same job on several sites: pick which copy to open */
export function LinkChooser({ title, urls, onOpen, onClose }: Props) {
    const ref = useRef<HTMLDialogElement>(null)
    useEffect(() => ref.current?.showModal(), [])

    return (
        // Clicking the backdrop lands on the dialog itself and closes it; Esc fires `close` natively
        <dialog
            ref={ref}
            class="link-chooser"
            onClose={onClose}
            onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
        >
            <div class="link-chooser-body">
                <strong>{title}</strong>
                <div class="hint">{t.card.chooser}</div>
                <div class="actions">
                    {urls.map((url) => (
                        <a
                            key={url}
                            class="btn"
                            href={url}
                            target="_blank"
                            rel="noopener"
                            onClick={() => {
                                onOpen()
                                ref.current?.close()
                            }}
                        >
                            {platformLabel(url)}
                        </a>
                    ))}
                    <button onClick={() => ref.current?.close()}>{t.common.cancel}</button>
                </div>
            </div>
        </dialog>
    )
}
