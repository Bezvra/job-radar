import { useEffect, useState } from 'preact/hooks'

/** Loads a value from chrome.storage and reloads it on every storage change (from any extension context). */
export function useStorage<T>(load: () => Promise<T>): T | undefined {
    const [value, setValue] = useState<T>()

    useEffect(() => {
        const update = () => void load().then(setValue)
        update()
        chrome.storage.onChanged.addListener(update)
        return () => chrome.storage.onChanged.removeListener(update)
    }, [load])

    return value
}
