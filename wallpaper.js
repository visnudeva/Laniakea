// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Graphene from 'gi://Graphene';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Mask from './mask.js';
import * as RendererControl from './rendererControl.js';

const applicationId = 'io.github.visnudeva.LaniakeaRenderer';
const CLICK_OVERLAY_RETRY_MS = 500;

export const LiveWallpaper = GObject.registerClass(
    class LiveWallpaper extends St.Widget {
        constructor(backgroundActor, settings = null) {
            super({
                layout_manager: new Clutter.BinLayout(),
                width: backgroundActor.width,
                height: backgroundActor.height,
                x_expand: true,
                y_expand: true,
            });

            this._backgroundActor = backgroundActor;
            this._settings = settings;
            this._isDisposed = false;
            this._timeoutId = null;
            this._wallpaper = null;
            this._sourceDestroyId = null;
            this._clickOverlay = null;
            this._clickOverlayRetryId = 0;

            backgroundActor.layout_manager = new Clutter.BinLayout();
            backgroundActor.add_child(this);
            this._hideStaticBackground();

            this._ensureClickOverlay();
            this._connectSettings();

            this.connect('destroy', () => {
                this._isDisposed = true;
                this._restoreStaticBackground();
                if (this._timeoutId) {
                    GLib.source_remove(this._timeoutId);
                    this._timeoutId = null;
                }
                if (this._clickOverlayRetryId) {
                    GLib.source_remove(this._clickOverlayRetryId);
                    this._clickOverlayRetryId = 0;
                }
                if (this._wallpaper) {
                    if (this._sourceDestroyId) {
                        this._wallpaper.source?.disconnect(this._sourceDestroyId);
                        this._sourceDestroyId = null;
                    }
                    this._wallpaper.source = null;
                    this._wallpaper.destroy();
                    this._wallpaper = null;
                }
                this._destroyClickOverlay();
                this._settings?.disconnectObject(this);
            });

            this.connect('notify::width', () => this._syncClickOverlayGeometry());
            this.connect('notify::height', () => this._syncClickOverlayGeometry());

            this._applyWallpaper();
        }

        _hideStaticBackground() {
            if (this._backgroundActor?.content)
                this._backgroundActor.content.opacity = 0;
        }

        _restoreStaticBackground() {
            if (this._backgroundActor?.content)
                this._backgroundActor.content.opacity = 255;
        }

        _getMaskMode() {
            const mode = this._settings?.get_string('draw-mask-mode') ?? Mask.MASK_MODES.CIRCLE;
            return mode === 'none' ? Mask.MASK_MODES.WIDE : mode;
        }

        _connectSettings() {
            if (!this._settings)
                return;

            this._settings.connectObject(
                'changed::draw-mask-mode',
                () => this._syncClickOverlayGeometry(),
                this,
            );
        }

        _getMonitor() {
            const monitorIndex = this._backgroundActor.monitor;
            return Main.layoutManager.monitors[monitorIndex] ?? null;
        }

        _ensureClickOverlay() {
            if (this._isDisposed || this._clickOverlay)
                return;

            const backgroundGroup = Main.layoutManager._backgroundGroup;
            const monitor = this._getMonitor();
            if (!backgroundGroup || !monitor) {
                if (!this._clickOverlayRetryId) {
                    this._clickOverlayRetryId = GLib.timeout_add(
                        CLICK_OVERLAY_RETRY_MS,
                        () => {
                            this._clickOverlayRetryId = 0;
                            this._ensureClickOverlay();
                            return GLib.SOURCE_REMOVE;
                        },
                    );
                }
                return;
            }

            this._clickOverlay = new St.Widget({
                reactive: true,
                can_focus: false,
            });
            this._syncClickOverlayGeometry();
            if (this._clickOverlay.set_z_position)
                this._clickOverlay.set_z_position(1);

            this._clickOverlay.connectObject(
                'button-press-event',
                (_actor, event) => this._onWallpaperClick(event),
                this,
            );

            backgroundGroup.add_child(this._clickOverlay);
            this._raiseClickOverlayToTop();

            backgroundGroup.connectObject(
                'child-added',
                () => this._raiseClickOverlayToTop(),
                this,
            );

            Main.overview.connectObject(
                'showing-changed',
                () => {
                    if (this._clickOverlay)
                        this._clickOverlay.visible = !Main.overview.visible;
                },
                this,
            );

            Main.layoutManager.connectObject(
                'monitors-changed',
                () => this._syncClickOverlayGeometry(),
                this,
            );
        }

        _syncClickOverlayGeometry() {
            if (!this._clickOverlay)
                return;

            const monitor = this._getMonitor();
            if (!monitor)
                return;

            const geometry = Mask.getOverlayGeometry(monitor, this._getMaskMode());

            this._clickOverlay.set_position(geometry.x, geometry.y);
            this._clickOverlay.set_size(geometry.width, geometry.height);
        }

        _raiseClickOverlayToTop() {
            const backgroundGroup = Main.layoutManager._backgroundGroup;
            if (!backgroundGroup?.contains(this._clickOverlay))
                return;

            const topIndex = backgroundGroup.get_n_children() - 1;
            if (topIndex < 0)
                return;

            const top = backgroundGroup.get_child_at_index(topIndex);
            if (top && top !== this._clickOverlay)
                backgroundGroup.set_child_above_sibling(this._clickOverlay, top);
        }

        _destroyClickOverlay() {
            const backgroundGroup = Main.layoutManager._backgroundGroup;

            if (this._clickOverlay)
                this._clickOverlay.disconnectObject(this);

            backgroundGroup?.disconnectObject(this);
            Main.overview.disconnectObject(this);
            Main.layoutManager.disconnectObject(this);

            if (this._clickOverlay) {
                if (backgroundGroup?.contains(this._clickOverlay))
                    backgroundGroup.remove_child(this._clickOverlay);
                this._clickOverlay.destroy();
                this._clickOverlay = null;
            }
        }

        _onWallpaperClick(event) {
            if (this._isDisposed)
                return Clutter.EVENT_PROPAGATE;

            if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                return Clutter.EVENT_PROPAGATE;

            const monitor = this._getMonitor();
            if (!monitor)
                return Clutter.EVENT_PROPAGATE;

            const [stageX, stageY] = event.get_coords();
            const relX = stageX - monitor.x;
            const relY = stageY - monitor.y;

            if (!Mask.isInsideMask(
                relX,
                relY,
                monitor.width,
                monitor.height,
                this._getMaskMode(),
            ))
                return Clutter.EVENT_PROPAGATE;

            RendererControl.reloadDrawing(this._backgroundActor.monitor);
            return Clutter.EVENT_STOP;
        }

        _applyWallpaper() {
            if (this._isDisposed)
                return;

            const operation = () => {
                if (this._isDisposed)
                    return false;

                const renderer = this._getRenderer();
                if (renderer) {
                    this._hideStaticBackground();
                    this._wallpaper = new Clutter.Clone({
                        source: renderer,
                        pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
                    });
                    this._wallpaper.connect('destroy', () => {
                        this._wallpaper = null;
                    });
                    this._sourceDestroyId = this._wallpaper.source.connect(
                        'destroy',
                        () => {
                            if (this._wallpaper)
                                this._wallpaper.destroy();
                            if (!this._isDisposed)
                                this._applyWallpaper();
                        },
                    );
                    this.add_child(this._wallpaper);
                    this._raiseClickOverlayToTop();
                    return false;
                }

                return true;
            };

            if (operation()) {
                this._timeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    1000,
                    operation,
                );
            }
        }

        _isLiveRenderer(actor) {
            const meta = actor.meta_window;
            if (!meta?.title?.includes(applicationId))
                return false;

            const pid = meta.get_pid();
            return pid > 0 && GLib.file_test(`/proc/${pid}`, GLib.FileTest.EXISTS);
        }

        _getRenderer() {
            const windowActors = global.get_window_actors(false);
            const rendererActors = windowActors.filter(actor => this._isLiveRenderer(actor));

            const numMonitors = global.display.get_n_monitors();
            if (rendererActors.length < numMonitors)
                return null;

            return rendererActors.find(
                window =>
                    window.meta_window.get_monitor() ===
                    this._backgroundActor.monitor,
            ) ?? null;
        }
    },
);
