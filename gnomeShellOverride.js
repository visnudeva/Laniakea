// SPDX-License-Identifier: GPL-3.0-or-later

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';

import {
    InjectionManager,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

import * as Wallpaper from './wallpaper.js';

const applicationId = 'io.github.visnudeva.LaniakeaRenderer';

export class GnomeShellOverride {
    constructor(settings = null) {
        this._injectionManager = new InjectionManager();
        this._wallpaperActors = new Set();
        this._settings = settings;
    }

    reloadBackgrounds() {
        this._reloadBackgrounds();
    }

    _reloadBackgrounds() {
        this._wallpaperActors.forEach(actor => actor.destroy());
        this._wallpaperActors.clear();

        const laters = global.compositor?.get_laters?.() ?? Meta.Laters?.get?.();
        if (laters) {
            laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
                Main.layoutManager._updateBackgrounds();
                if (Main.screenShield?._dialog?._updateBackgrounds != null)
                    Main.screenShield._dialog._updateBackgrounds();

                Main.overview?._overview?._controls?._workspacesDisplay?._updateWorkspacesViews?.();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    enable() {
        const thisRef = this;

        this._injectionManager.overrideMethod(
            Background.BackgroundManager.prototype,
            '_createBackgroundActor',
            originalMethod => {
                return function () {
                    const backgroundActor = originalMethod.call(this);

                    const isLockScreen =
                        this._container.style_class?.includes('screen-shield-background') ?? false;
                    if (isLockScreen && !thisRef._settings?.get_boolean('show-on-lock-screen'))
                        return backgroundActor;

                    this.videoActor = new Wallpaper.LiveWallpaper(
                        backgroundActor,
                        thisRef._settings,
                    );
                    thisRef._wallpaperActors.add(this.videoActor);

                    this.videoActor.connect('destroy', actor => {
                        thisRef._wallpaperActors.delete(actor);
                        if (this.videoActor === actor)
                            this.videoActor = null;
                    });

                    return backgroundActor;
                };
            },
        );

        this._injectionManager.overrideMethod(
            Shell.Global.prototype,
            'get_window_actors',
            originalMethod => {
                return function (hideRenderer = true) {
                    const windowActors = originalMethod.call(this);
                    return hideRenderer
                        ? windowActors.filter(
                            actor => !actor.meta_window.title?.includes(applicationId),
                        )
                        : windowActors;
                };
            },
        );

        this._injectionManager.overrideMethod(
            Workspace.Workspace.prototype,
            '_isOverviewWindow',
            originalMethod => {
                return function (window) {
                    return window.title?.includes(applicationId)
                        ? false
                        : originalMethod.apply(this, [window]);
                };
            },
        );

        this._injectionManager.overrideMethod(
            WorkspaceThumbnail.WorkspaceThumbnail.prototype,
            '_isOverviewWindow',
            originalMethod => {
                return function (window) {
                    return window.title?.includes(applicationId)
                        ? false
                        : originalMethod.apply(this, [window]);
                };
            },
        );

        this._injectionManager.overrideMethod(
            Meta.Workspace.prototype,
            'list_windows',
            originalMethod => {
                return function () {
                    return originalMethod
                        .call(this)
                        .filter(metaWindow => !metaWindow.title?.includes(applicationId));
                };
            },
        );

        this._injectionManager.overrideMethod(
            Meta.Display.prototype,
            'list_all_windows',
            originalMethod => {
                return function () {
                    return originalMethod
                        .call(this)
                        .filter(metaWindow => !metaWindow.title?.includes(applicationId));
                };
            },
        );

        this._injectionManager.overrideMethod(
            Meta.Display.prototype,
            'get_tab_list',
            originalMethod => {
                return function (type, workspace) {
                    return originalMethod
                        .apply(this, [type, workspace])
                        .filter(metaWindow => !metaWindow.title?.includes(applicationId));
                };
            },
        );

        this._injectionManager.overrideMethod(
            Shell.WindowTracker.prototype,
            'get_window_app',
            originalMethod => {
                return function (window) {
                    return window.title?.includes(applicationId)
                        ? null
                        : originalMethod.apply(this, [window]);
                };
            },
        );

        this._injectionManager.overrideMethod(
            Shell.App.prototype,
            'get_windows',
            originalMethod => {
                return function () {
                    return originalMethod
                        .call(this)
                        .filter(metaWindow => !metaWindow.title?.includes(applicationId));
                };
            },
        );

        this._injectionManager.overrideMethod(
            Shell.App.prototype,
            'get_n_windows',
            _originalMethod => {
                return function () {
                    return this.get_windows().length;
                };
            },
        );

        this._injectionManager.overrideMethod(
            Shell.AppSystem.prototype,
            'get_running',
            originalMethod => {
                return function () {
                    return originalMethod
                        .call(this)
                        .filter(app => app.get_n_windows() > 0);
                };
            },
        );

        if (this._settings) {
            this._settings.connectObject(
                'changed::show-on-lock-screen',
                () => this._reloadBackgrounds(),
                this,
            );
        }

        this._reloadBackgrounds();
    }

    disable() {
        this._settings?.disconnectObject(this);

        this._injectionManager.clear();
        this._reloadBackgrounds();
    }
}
