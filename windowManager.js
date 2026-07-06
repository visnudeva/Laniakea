// SPDX-License-Identifier: GPL-3.0-or-later

import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import * as Logger from './logger.js';

const applicationId = 'io.github.visnudeva.LaniakeaRenderer';
const logger = new Logger.Logger();

const shellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

class ManagedWindow {
    constructor(window) {
        this._window = window;
        this._states = {
            position: [0, 0],
            keepAtBottom: false,
            keepMinimized: false,
            keepPosition: false,
        };

        this._isDisposed = false;
        this._afterSignalIds = [
            window.connect_after('shown', () => {
                if (this._isDisposed)
                    return;
                if (this._states.keepMinimized)
                    this._window.minimize();
            }),
            window.connect_after('raised', () => {
                if (this._isDisposed)
                    return;
                if (this._states.keepAtBottom)
                    this._window.lower();
            }),
        ];

        window.connectObject(
            'notify::title',
            () => {
                if (this._isDisposed)
                    return;
                this._parseTitle();
            },
            'notify::above',
            () => {
                if (this._isDisposed)
                    return;
                if (this._states.keepAtBottom && this._window.above)
                    this._window.unmake_above();
            },
            'notify::fullscreen',
            () => {
                if (this._isDisposed)
                    return;
                if (this._window.fullscreen)
                    this._window.unmake_fullscreen();
            },
            'notify::minimized',
            () => {
                if (this._isDisposed)
                    return;
                if (this._states.keepMinimized && !this._window.minimized)
                    this._window.minimize();
            },
            'position-changed',
            () => {
                if (this._isDisposed)
                    return;
                if (this._states.keepPosition) {
                    const [x, y] = this._states.position;
                    this._window.move_frame(true, x, y);
                }
            },
            this,
        );

        this._parseTitle();
    }

    _parseTitle() {
        const title = this._window.title;
        if (title?.startsWith(`@${applicationId}!`)) {
            const json = title.replace(`@${applicationId}!`, '').split('|')[0];
            try {
                const newState = JSON.parse(json);
                this._states = {...this._states, ...newState};
            } catch (e) {
                logger.trace(e);
            }
        }
        this._refresh();
    }

    _refresh() {
        if (this._window.fullscreen)
            this._window.unmake_fullscreen();
        if (this._window.maximized_horizontally || this._window.maximized_vertically)
            this._window.unmaximize();
        if (this._states.keepAtBottom && this._window.above)
            this._window.unmake_above();
        if (this._states.keepPosition) {
            const [x, y] = this._states.position;
            this._window.move_frame(true, x, y);
        }
        if (this._states.keepMinimized && !this._window.minimized)
            this._window.minimize();
    }

    disconnect() {
        this._isDisposed = true;
        for (const id of this._afterSignalIds)
            this._window?.disconnect(id);
        this._afterSignalIds = [];
        this._window?.disconnectObject(this);
        this._window = null;
    }
}

export class WindowManager {
    constructor() {
        if (shellVersion < 50)
            this._isX11 = !Meta.is_wayland_compositor();
        else
            this._isX11 = false;

        this._windows = new Set();
        this._waylandClient = null;
    }

    set_wayland_client(client) {
        this._waylandClient = client;
        if (client)
            this._trackExistingWindows();
    }

    _isRendererWindow(window) {
        if (!window)
            return false;

        if (window.title?.includes(applicationId))
            return true;

        return this._waylandClient?.query_window_belongs_to(window) ?? false;
    }

    _trackExistingWindows() {
        for (const actor of global.get_window_actors(false))
            this._maybeAddWindow(actor.meta_window);
    }

    _maybeAddWindow(window) {
        if (!window?.managed && this._isRendererWindow(window))
            this.addWindow(window);
    }

    enable() {
        global.window_manager.connectObject(
            'map',
            (_wm, windowActor) => {
                this._maybeAddWindow(windowActor.get_meta_window());
            },
            this,
        );

        this._trackExistingWindows();
    }

    disable() {
        this._windows.forEach(window => {
            this._clearWindow(window);
        });
        this._windows.clear();

        global.window_manager.disconnectObject(this);
    }

    addWindow(window) {
        if (window.get_meta_window)
            window = window.get_meta_window();

        if (window.managed)
            return;

        window.managed = new ManagedWindow(window);
        this._windows.add(window);
        window.connectObject(
            'unmanaged',
            managedWindow => {
                this._clearWindow(managedWindow);
                this._windows.delete(managedWindow);
            },
            this,
        );
    }

    _clearWindow(window) {
        window.disconnectObject(this);
        window.managed.disconnect();
        window.managed = null;
    }
}
