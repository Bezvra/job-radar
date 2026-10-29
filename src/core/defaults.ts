import type { Settings } from './types'

/**
 * Limits that keep the requests to the sites polite: every enabled feed is fetched on each refresh, from the user's own
 * IP, so dozens of feeds every hour could get it blocked
 */
export const MAX_SOURCES = 10
export const MIN_INTERVAL_HOURS = 2

export const DEFAULT_SETTINGS: Settings = {
    // No built-in sources either: the onboarding wizard suggests feeds for the user's stack (see core/feeds.ts)
    sources: [],
    // No built-in rules: they come from the CV in the onboarding wizard (or are added on the Filters tab)
    rules: [],
    applyThreshold: 60,
    hideBelow: 25,
    maxAgeDays: 3,
    unlistedTech: { title: -15, description: -8 },
    techBonusCap: 30,
    minSalary: 0,
    intervalHours: 3,
    notify: true,
    telegram: { enabled: false, botToken: '', chatId: '' },
    locale: 'auto',
}
