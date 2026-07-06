// SPDX-License-Identifier: GPL-3.0-or-later

import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import * as Logger from './logger.js';

const logger = new Logger.Logger();
const rendererLogger = new Logger.Logger('LaniakeaRenderer');

const shellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

export class LaunchSubprocess {
    constructor(flags = Gio.SubprocessFlags.NONE) {
        if (shellVersion < 50)
            this._isX11 = !Meta.is_wayland_compositor();
        else
            this._isX11 = false;

        this._flags = flags |
            Gio.SubprocessFlags.STDOUT_PIPE |
            Gio.SubprocessFlags.STDERR_MERGE;

        this.cancellable = new Gio.Cancellable();
        this._launcher = new Gio.SubprocessLauncher({flags: this._flags});

        if (!this._isX11 && shellVersion < 49) {
            this._waylandClient = Meta.WaylandClient.new(
                global.context,
                this._launcher,
            );
        }

        this.subprocess = null;
        this.running = false;
    }

    spawnv(argv) {
        if (!this._isX11) {
            if (shellVersion < 49) {
                this.subprocess = this._waylandClient.spawnv(
                    global.display,
                    argv,
                );
            } else {
                this._waylandClient = Meta.WaylandClient.new_subprocess(
                    global.context,
                    this._launcher,
                    argv,
                );
                this.subprocess = this._waylandClient.get_subprocess();
            }
        } else {
            this.subprocess = this._launcher.spawnv(argv);
        }

        if (this._launcher.close)
            this._launcher.close();

        this._launcher = null;
        if (this.subprocess) {
            this._dataInputStream = Gio.DataInputStream.new(
                this.subprocess.get_stdout_pipe(),
            );
            this._readOutput();
            this.subprocess.wait_async(this.cancellable, () => {
                this.running = false;
                this._dataInputStream = null;
                this.cancellable = null;
            });
            this.running = true;
        }
        return this.subprocess;
    }

    set_cwd(cwd) {
        this._launcher.set_cwd(cwd);
    }

    _readOutput() {
        if (!this._dataInputStream)
            return;

        this._dataInputStream.read_line_async(
            GLib.PRIORITY_DEFAULT,
            this.cancellable,
            (object, res) => {
                try {
                    const [output, length] = object.read_line_finish_utf8(res);
                    if (length)
                        rendererLogger.log(output);
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        return;
                    logger.trace(e);
                }

                this._readOutput();
            },
        );
    }

    query_window_belongs_to(window) {
        if (this._isX11)
            return false;

        if (!this.running)
            return false;

        try {
            return this._waylandClient.owns_window(window);
        } catch (e) {
            logger.trace(e);
            return false;
        }
    }
}
