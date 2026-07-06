// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Logger from './logger.js';

const logger = new Logger.Logger();
const DESKTOP_BACKGROUND_SCHEMA = 'org.gnome.desktop.background';
const PICTURE_OPTIONS_NONE = 0;

export const CACHE_DIR = GLib.build_filenamev([
    GLib.get_user_cache_dir(),
    'laniakea',
]);

function isLaniakeaWallpaperUri(uri) {
    return uri?.includes('/laniakea/wallpaper-');
}

export function clearLaniakeaDesktopWallpaper() {
    const settings = new Gio.Settings({schema_id: DESKTOP_BACKGROUND_SCHEMA});
    const uri = settings.get_string('picture-uri');
    const uriDark = settings.get_string('picture-uri-dark');

    if (!isLaniakeaWallpaperUri(uri) && !isLaniakeaWallpaperUri(uriDark))
        return false;

    settings.set_string('picture-uri', '');
    settings.set_string('picture-uri-dark', '');
    settings.set_enum('picture-options', PICTURE_OPTIONS_NONE);
    settings.set_string('primary-color', '#141414');
    return true;
}

export function removeCachedWallpaperFiles() {
    const dir = Gio.File.new_for_path(CACHE_DIR);
    if (!dir.query_exists(null))
        return;

    const enumerator = dir.enumerate_children(
        'standard::name',
        Gio.FileQueryInfoFlags.NONE,
        null,
    );

    let info;
    while ((info = enumerator.next_file(null))) {
        const name = info.get_name();
        if (!name.startsWith('wallpaper-') || !name.endsWith('.png'))
            continue;

        const file = dir.get_child(name);
        try {
            file.delete(null);
        } catch (e) {
            logger.trace(e);
        }
    }
}
