# <img src="https://github.com/visnudeva/Laniakea/blob/main/docs/assets/logo.png?raw=true" width="100"> Laniakea

**A GNOME Shell extension that turns your desktop into a generative live wallpaper.**

Laniakea renders a flowing p5.js particle field behind your windows and panels. Each session starts with a fresh random pattern at login, and you can click the masked area on your desktop to generate a new one anytime.

## Features

- **Generative flow-field wallpaper** — colorful particles drift along a Perlin-noise vector field
- **New pattern on every login** — random colors, density, and flow parameters each time
- **Click to regenerate** — primary-click inside the shape mask to reset the drawing
- **Shape mask** — limit where particles are drawn (circle, triangles, diamond, hexagon, rectangles, or wide cicle)
- **Multi-monitor** — one renderer window per display
- **Resume-aware** — redraws after sleep, screen wake, and monitor changes

## Customization

Open **Extensions → Laniakea → Settings** to choose a **Shape** that limits where new particles appear:

| Shape | Description |
|---|---|
| Circle | Round central area (default) |
| Triangle up / down | Triangular mask |
| Diamond | Rotated square |
| Hexagon | Regular hexagon |
| Vertical / horizontal rectangle | Rectangular masks |
| Wide | Wide circle with shaded gradient |

## Installation

### From GNOME Extensions (recommended)

Once published, install from [extensions.gnome.org](https://extensions.gnome.org/).

### Manual installation

```bash
# Copy to your local extensions directory
cp -r Laniakea ~/.local/share/gnome-shell/extensions/Laniakea@visnudeva.github.io

# Compile GSettings schemas
glib-compile-schemas ~/.local/share/gnome-shell/extensions/Laniakea@visnudeva.github.io/schemas/

# Enable the extension
gnome-extensions enable Laniakea@visnudeva.github.io

# Restart GNOME Shell (Wayland: log out and back in; X11: Alt+F2 → r)
```

## How it works

1. The extension installs a **GJS WebKit renderer** into `~/.cache/laniakea/` and launches it for each monitor.
2. The renderer loads `index.html`, which runs a p5.js sketch that animates particles along a noise field.
3. The shell clones the renderer window onto each monitor's background layer as a live wallpaper.
4. Clicking inside the configured shape sends a D-Bus reload to that monitor's renderer.
5. After resume or wake, the extension soft-reloads the drawing and falls back to a hard restart if needed.

## Requirements

- GNOME Shell 48–50
- GJS (`gjs` on PATH)
- WebKitGTK 6 (`webkit2gtk-4.1` / `gir1.2-webkit-6.0`)

On Fedora:

```bash
sudo dnf install gjs webkit2gtk4.1
```

The wallpaper sketch loads p5.js from jsDelivr on first run (network required once per session unless cached by WebKit).

## Troubleshooting

**Extension enabled but wallpaper is black?**

- Check that the renderer is running: look for `laniakea-renderer.gs` under `~/.cache/laniakea/`.
- View extension logs: `journalctl -f -o cat | grep -i laniakea`
- Restart the extension:
  ```bash
  gnome-extensions disable Laniakea@visnudeva.github.io
  gnome-extensions enable Laniakea@visnudeva.github.io
  ```

**Click-to-regenerate not working?**

- Make sure you click inside the configured shape mask (not on a wide/unmasked desktop region at the edges, unless **Wide** is selected).
- The renderer must be fully loaded — wait a moment after login.

**Wallpaper missing after sleep?**

- Laniakea reloads automatically on resume. If it does not recover, toggle the extension off and on.

## Development

Run the unit tests (mask geometry, config parity, preference values):

```bash
node --test tests/*.test.mjs
```

## License

GNU General Public License v3.0 or later. See the SPDX headers in source files for details.

## Contributing

Issues and pull requests are welcome at [github.com/visnudeva/Laniakea](https://github.com/visnudeva/Laniakea).
