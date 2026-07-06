import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    MASK_MODE_LABELS,
    MASK_MODE_VALUES,
    maskModeIndex,
} from './maskModes.js';

export default class LaniakeaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Laniakea',
            icon_name: 'preferences-desktop-wallpaper-symbolic',
        });
        window.add(page);

        const drawingGroup = new Adw.PreferencesGroup({
            title: 'Drawing',
            description: 'Control where particles are drawn',
        });
        page.add(drawingGroup);

        const maskRow = new Adw.ComboRow({
            title: 'Shape',
            subtitle: 'Limits where new particles appear',
            model: Gtk.StringList.new(MASK_MODE_LABELS),
            selected: maskModeIndex(settings.get_string('draw-mask-mode')),
        });
        maskRow.connect('notify::selected', () => {
            settings.set_string(
                'draw-mask-mode',
                MASK_MODE_VALUES[maskRow.get_selected()],
            );
        });

        const settingsChangedId = settings.connect(
            'changed::draw-mask-mode',
            () => {
                const index = maskModeIndex(settings.get_string('draw-mask-mode'));
                if (maskRow.get_selected() !== index)
                    maskRow.set_selected(index);
            },
        );

        window.connect('close-request', () => {
            settings.disconnect(settingsChangedId);
        });

        drawingGroup.add(maskRow);
    }
}
