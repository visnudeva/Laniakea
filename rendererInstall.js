// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {RENDERER_SCRIPT, RENDERER_VERSION} from './rendererScript.js';

export const RENDERER_PROCESS_MARKER = 'laniakea-renderer.gs';

let _installedRendererVersion = null;

export function getRendererScriptPath() {
    const cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'laniakea']);
    const scriptPath = GLib.build_filenamev([cacheDir, RENDERER_PROCESS_MARKER]);

    const dir = Gio.File.new_for_path(cacheDir);
    if (!dir.query_exists(null))
        dir.make_directory_with_parents(null);

    const scriptFile = Gio.File.new_for_path(scriptPath);
    const needsInstall = _installedRendererVersion !== RENDERER_VERSION ||
        !scriptFile.query_exists(null);

    if (needsInstall) {
        scriptFile.replace_contents(
            RENDERER_SCRIPT,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
        );
        scriptFile.set_attribute_uint32(
            'unix::mode',
            0o755,
            Gio.FileQueryInfoFlags.NONE,
            null,
        );
        _installedRendererVersion = RENDERER_VERSION;
    }

    return scriptPath;
}

export function getRendererProcessMarker() {
    return GLib.build_filenamev([
        GLib.get_user_cache_dir(),
        'laniakea',
        RENDERER_PROCESS_MARKER,
    ]);
}
