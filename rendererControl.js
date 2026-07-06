// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Logger from './logger.js';

const APPLICATION_ID = 'io.github.visnudeva.LaniakeaRenderer';
const OBJECT_PATH = '/io/github/visnudeva/LaniakeaRenderer';
const logger = new Logger.Logger();

export function pushRendererConfig() {
    Gio.DBus.session.call(
        APPLICATION_ID,
        OBJECT_PATH,
        'org.freedesktop.Application',
        'ActivateAction',
        new GLib.Variant('(sava{sv})', [
            'configure',
            [],
            {},
        ]),
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
        (connection, result) => {
            try {
                connection.call_finish(result);
            } catch (e) {
                logger.trace(e);
            }
        },
    );
}

const RELOAD_MAX_ATTEMPTS = 8;
const RELOAD_RETRY_MS = 250;

export function reloadAllDrawing(attempt = 0) {
    Gio.DBus.session.call(
        APPLICATION_ID,
        OBJECT_PATH,
        'org.freedesktop.Application',
        'ActivateAction',
        new GLib.Variant('(sava{sv})', [
            'reload-all',
            [],
            {},
        ]),
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
        (connection, result) => {
            try {
                connection.call_finish(result);
            } catch (e) {
                if (attempt < RELOAD_MAX_ATTEMPTS) {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, RELOAD_RETRY_MS, () => {
                        reloadAllDrawing(attempt + 1);
                        return GLib.SOURCE_REMOVE;
                    });
                    return;
                }
                logger.trace(e);
            }
        },
    );
}

export function reloadDrawing(monitorIndex, attempt = 0) {
    Gio.DBus.session.call(
        APPLICATION_ID,
        OBJECT_PATH,
        'org.freedesktop.Application',
        'ActivateAction',
        new GLib.Variant('(sava{sv})', [
            'reload',
            [GLib.Variant.new_int32(monitorIndex)],
            {},
        ]),
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
        (connection, result) => {
            try {
                connection.call_finish(result);
            } catch (e) {
                if (attempt < RELOAD_MAX_ATTEMPTS) {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, RELOAD_RETRY_MS, () => {
                        reloadDrawing(monitorIndex, attempt + 1);
                        return GLib.SOURCE_REMOVE;
                    });
                    return;
                }
                logger.trace(e);
            }
        },
    );
}
