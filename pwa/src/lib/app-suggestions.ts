export interface AppSuggestion {
    label: string;
    path: string;
}

export const BUILTIN_APPS: AppSuggestion[] = [
    { label: 'Safari', path: '/Applications/Safari.app' },
    { label: 'Mail', path: '/System/Applications/Mail.app' },
    { label: 'Messages', path: '/System/Applications/Messages.app' },
    { label: 'FaceTime', path: '/System/Applications/FaceTime.app' },
    { label: 'Calendar', path: '/System/Applications/Calendar.app' },
    { label: 'Photos', path: '/System/Applications/Photos.app' },
    { label: 'Contacts', path: '/System/Applications/Contacts.app' },
    { label: 'Maps', path: '/System/Applications/Maps.app' },
    { label: 'Notes', path: '/System/Applications/Notes.app' },
    { label: 'Reminders', path: '/System/Applications/Reminders.app' },
    { label: 'Freeform', path: '/System/Applications/Freeform.app' },
    { label: 'TV', path: '/System/Applications/TV.app' },
    { label: 'Music', path: '/System/Applications/Music.app' },
    { label: 'Podcasts', path: '/System/Applications/Podcasts.app' },
    { label: 'App Store', path: '/System/Applications/App Store.app' },
    { label: 'System Settings', path: '/System/Applications/System Settings.app' },
    { label: 'Finder', path: '/System/Library/CoreServices/Finder.app' },
    { label: 'Launchpad', path: '/System/Applications/Launchpad.app' },
    { label: 'Calculator', path: '/System/Applications/Calculator.app' },
    { label: 'Terminal', path: '/System/Applications/Utilities/Terminal.app' },
    { label: 'Activity Monitor', path: '/System/Applications/Utilities/Activity Monitor.app' },
    { label: 'Console', path: '/System/Applications/Utilities/Console.app' },
    { label: 'Disk Utility', path: '/System/Applications/Utilities/Disk Utility.app' },
];

const STORAGE_KEY = 'dock-builder-custom-apps';

export function getCustomApps(): AppSuggestion[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

export function saveCustomApps(apps: AppSuggestion[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

export function getAllSuggestions(): AppSuggestion[] {
    const custom = getCustomApps();
    // Merge and remove duplicates by path
    const all = [...BUILTIN_APPS, ...custom];
    const seen = new Set();
    return all.filter(app => {
        if (seen.has(app.path)) return false;
        seen.add(app.path);
        return true;
    });
}

/**
 * Parses a directory listing (e.g. from 'ls /Applications' or 'dir /Applications')
 * and extracts potential application names and paths.
 */
export function parseDirectoryListing(input: string, basePath: string = '/Applications'): AppSuggestion[] {
    const lines = input.split(/\r?\n/);
    const apps: AppSuggestion[] = [];

    // Clean up basePath: ensure it starts with / and doesn't end with /
    const cleanBase = basePath.startsWith('/') ? basePath : '/' + basePath;
    const finalBase = cleanBase.endsWith('/') ? cleanBase.slice(0, -1) : cleanBase;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Detect app names. Look for anything ending in .app or just lines that look like app names
        // If it's a "dir" output, it might have date/time/size etc.
        // We try to find the part that looks like "SomeApp.app" or just a proper name.

        // Pattern 1: Simple filename ending in .app
        const appMatch = line.match(/([^\/\\:*?"<>|]+\.app)/i);
        if (appMatch) {
            const appName = appMatch[1];
            const label = appName.replace(/\.app$/i, '');
            apps.push({
                label,
                path: `${finalBase}/${appName}`
            });
        } else if (line.length > 0 && line.length < 100 && !line.includes(' ') && !line.includes('.')) {
            // Pattern 2: Single word (likely an app if pasted from a clean list)
            apps.push({
                label: line,
                path: `${finalBase}/${line}.app`
            });
        }
    }

    return apps;
}
