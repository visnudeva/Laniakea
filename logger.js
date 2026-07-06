// SPDX-License-Identifier: GPL-3.0-or-later

export class Logger {
    constructor(prefix = 'Laniakea') {
        this._prefix = prefix;
    }

    log(message) {
        log(`[${this._prefix}] ${message}`);
    }

    trace(error) {
        logError(error, this._prefix);
    }
}
