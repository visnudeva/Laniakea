// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getLoginManager} from 'resource:///org/gnome/shell/misc/loginManager.js';
import {
    Extension,
} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as GnomeShellOverride from './gnomeShellOverride.js';
import * as Launcher from './launcher.js';
import * as RendererControl from './rendererControl.js';
import * as WindowManager from './windowManager.js';
import {
    clearLaniakeaDesktopWallpaper,
    removeCachedWallpaperFiles,
} from './wallpaperCleanup.js';
import * as RendererInstall from './rendererInstall.js';
import './maskConfig.js';

const APPLICATION_ID = 'io.github.visnudeva.LaniakeaRenderer';
const RESUME_SOFT_RELOAD_DELAYS_MS = [0, 200, 500, 1000, 2000];
const HARD_RELOAD_FALLBACK_MS = 5000;
const STALE_WINDOW_POLL_MS = 200;
const STALE_WINDOW_MAX_ATTEMPTS = 30;

export default class LaniakeaExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._currentProcess = null;
        this._launchRendererId = 0;
        this._reloadTime = 100;
        this._resumeReloadGeneration = 0;
        this._resumeReloadTimeoutIds = [];
        this._hardReloadFallbackId = 0;
        this._startupDelayTimeoutId = 0;
        this._monitorsChangedTimeoutId = 0;
    }

    enable() {
        this._settings = this.getSettings();
        this._killRendererProcesses();
        clearLaniakeaDesktopWallpaper();
        removeCachedWallpaperFiles();
        this._override = new GnomeShellOverride.GnomeShellOverride(this._settings);
        this._manager = new WindowManager.WindowManager();

        this._settings.connectObject(
            'changed::draw-mask-mode',
            () => RendererControl.pushRendererConfig(),
            this,
        );

        if (Main.layoutManager._startingUp) {
            Main.layoutManager.connectObject(
                'startup-complete',
                () => this._scheduleStartup(),
                this,
            );
        } else {
            this._scheduleStartup();
        }
    }

    _scheduleStartup() {
        this._clearStartupDelayTimeout();
        this._startupDelayTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this._settings.get_int('startup-delay'),
            () => {
                this._startupDelayTimeoutId = 0;
                this._innerEnable();
                return GLib.SOURCE_REMOVE;
            },
        );
    }

    _clearStartupDelayTimeout() {
        if (this._startupDelayTimeoutId) {
            GLib.source_remove(this._startupDelayTimeoutId);
            this._startupDelayTimeoutId = 0;
        }
    }

    _innerEnable() {
        this._override.enable();
        this._manager.enable();

        Main.layoutManager.connectObject(
            'monitors-changed',
            () => {
                if (this._monitorsChangedTimeoutId)
                    GLib.source_remove(this._monitorsChangedTimeoutId);
                this._monitorsChangedTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    500,
                    () => {
                        this._monitorsChangedTimeoutId = 0;
                        this._killCurrentProcess();
                        return GLib.SOURCE_REMOVE;
                    },
                );
            },
            this,
        );

        this._loginManager = getLoginManager();
        this._loginManager.connectObject(
            'prepare-for-sleep',
            (_loginManager, aboutToSuspend) => {
                if (aboutToSuspend)
                    return;

                this._scheduleReloadDrawing();
            },
            this,
        );

        this._launchRenderer();
    }

    _scheduleReloadDrawing() {
        this._resumeReloadGeneration++;
        const generation = this._resumeReloadGeneration;

        this._clearResumeReloadTimeouts();

        for (const delay of RESUME_SOFT_RELOAD_DELAYS_MS) {
            const timeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                delay,
                () => {
                    this._resumeReloadTimeoutIds =
                        this._resumeReloadTimeoutIds.filter(id => id !== timeoutId);
                    if (generation !== this._resumeReloadGeneration)
                        return GLib.SOURCE_REMOVE;

                    this._softReloadDrawing();
                    return GLib.SOURCE_REMOVE;
                },
            );
            this._resumeReloadTimeoutIds.push(timeoutId);
        }

        const hardReloadDelay = this._currentProcess?.running
            ? HARD_RELOAD_FALLBACK_MS
            : 0;

        this._hardReloadFallbackId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            hardReloadDelay,
            () => {
                this._hardReloadFallbackId = 0;
                if (generation !== this._resumeReloadGeneration)
                    return GLib.SOURCE_REMOVE;

                if (!this._rendererLooksHealthy())
                    this._hardReloadDrawing();
                return GLib.SOURCE_REMOVE;
            },
        );
    }

    _clearResumeReloadTimeouts() {
        for (const timeoutId of this._resumeReloadTimeoutIds)
            GLib.source_remove(timeoutId);
        this._resumeReloadTimeoutIds = [];

        if (this._hardReloadFallbackId) {
            GLib.source_remove(this._hardReloadFallbackId);
            this._hardReloadFallbackId = 0;
        }
    }

    _softReloadDrawing() {
        if (this._currentProcess?.running)
            RendererControl.reloadAllDrawing();
    }

    _countLiveRendererWindows() {
        let live = 0;

        for (const actor of global.get_window_actors(false)) {
            const meta = actor.meta_window;
            if (!meta?.title?.includes(APPLICATION_ID))
                continue;

            const pid = meta.get_pid();
            if (pid > 0 && GLib.file_test(`/proc/${pid}`, GLib.FileTest.EXISTS))
                live++;
        }

        return live;
    }

    _rendererLooksHealthy() {
        return this._countLiveRendererWindows() >= global.display.get_n_monitors() &&
            this._currentProcess?.running;
    }

    _hardReloadDrawing() {
        this._killCurrentProcess();
        this._killRendererProcesses(true);
        this._currentProcess = null;
        this._manager.set_wayland_client(null);
        this._override.reloadBackgrounds();
        this._scheduleLaunchRendererAfterCleanup();
    }

    _scheduleLaunchRendererAfterCleanup(attempt = 0) {
        if (this._launchRendererId) {
            GLib.source_remove(this._launchRendererId);
            this._launchRendererId = 0;
        }

        if (this._countLiveRendererWindows() > 0 && attempt < STALE_WINDOW_MAX_ATTEMPTS) {
            this._launchRendererId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                STALE_WINDOW_POLL_MS,
                () => {
                    this._launchRendererId = 0;
                    this._scheduleLaunchRendererAfterCleanup(attempt + 1);
                    return GLib.SOURCE_REMOVE;
                },
            );
            return;
        }

        this._launchRenderer();
    }

    _launchRenderer() {
        if (!this._settings)
            return;

        this._reloadTime = 100;
        const rendererPath = RendererInstall.getRendererScriptPath();
        const gjs = GLib.find_program_in_path('gjs') ?? '/usr/bin/gjs';
        const argv = [
            gjs,
            '-m',
            rendererPath,
            '--',
            '--path',
            this.path,
        ];

        this._currentProcess = new Launcher.LaunchSubprocess();
        this._currentProcess.set_cwd(GLib.get_home_dir());
        this._currentProcess.spawnv(argv);
        this._manager.set_wayland_client(this._currentProcess);

        this._currentProcess.subprocess.wait_async(null, (obj, res) => {
            obj.wait_finish(res);
            if (!this._settings || !this._currentProcess || obj !== this._currentProcess.subprocess)
                return;

            this._reloadTime =
                obj.get_if_exited() && obj.get_exit_status() !== 0 ? 1000 : 100;

            this._currentProcess = null;
            this._manager.set_wayland_client(null);

            if (this._launchRendererId)
                GLib.source_remove(this._launchRendererId);

            this._launchRendererId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._reloadTime,
                () => {
                    this._launchRendererId = 0;
                    this._launchRenderer();
                    return GLib.SOURCE_REMOVE;
                },
            );
        });
    }

    disable() {
        this._killCurrentProcess();
        this._clearStartupDelayTimeout();
        this._clearResumeReloadTimeouts();

        if (this._monitorsChangedTimeoutId) {
            GLib.source_remove(this._monitorsChangedTimeoutId);
            this._monitorsChangedTimeoutId = 0;
        }

        Main.layoutManager.disconnectObject(this);
        this._loginManager?.disconnectObject(this);
        this._settings?.disconnectObject(this);

        this._override?.disable();
        this._manager?.disable();

        this._settings = null;
        this._override = null;
        this._manager = null;
        this._loginManager = null;
    }

    _killCurrentProcess() {
        if (this._launchRendererId) {
            GLib.source_remove(this._launchRendererId);
            this._launchRendererId = 0;
        }

        if (this._currentProcess?.subprocess) {
            this._currentProcess.cancellable.cancel();
            this._currentProcess.subprocess.send_signal(15);
            this._currentProcess = null;
        }
    }

    _killRendererProcesses(force = false) {
        const marker = RendererInstall.getRendererProcessMarker();
        const argv = force
            ? ['pkill', '-9', '-f', marker]
            : ['pkill', '-f', marker];

        try {
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE).wait(null);
        } catch {
            // pkill exits with status 1 when no matching process exists.
        }
    }
}
