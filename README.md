# Freebody Diagram Studio

A zero-dependency, browser-based editor for drawing, annotating, and exporting free body diagrams.

## Install

Download the newest installer from the
[GitHub Releases page](https://github.com/Mindersteve/freebody-diagram-studio/releases/latest):

- **macOS:** choose the `.dmg` matching Apple Silicon (`arm64`) or Intel (`x64`).
- **Windows:** choose the `.exe` installer. A portable `.exe` is also available.
- **Linux:** choose the `.AppImage`, or the `.deb` for Debian/Ubuntu.

The packages are currently unsigned. On macOS, control-click the app and choose
**Open** the first time. On Windows, choose **More info → Run anyway** if
SmartScreen appears.

You can also use the
[web version](https://mindersteve.github.io/freebody-diagram-studio/) without
installing anything.

## Run from source

Install [Node.js 22 or newer](https://nodejs.org/), then:

```bash
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173).

For the desktop development build:

```bash
npm run desktop
```

## Create installers

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Each command should be run on its matching operating system. Pushing a version
tag such as `v1.0.0` runs the GitHub Actions release workflow and attaches every
platform installer to a GitHub release automatically.

## Features

- Rigid bodies, force vectors, inclined surfaces, dimensions, coordinate axes, and text
- Drag-to-draw editing with grid snapping
- Independently draggable labels and one-click removable anchor dots
- LaTeX-style labels including Greek symbols, subscripts, superscripts, vectors, and fractions
- Per-label font family, size, weight, and italic controls
- Labeled point objects and straight-line smart dimensions with geometry snapping, scale, units, and precision
- Configurable surface labels with independent label and calculated-angle visibility
- Optional “Trim FBD” export mode that removes unnecessary outer whitespace
- Marquee multi-selection with group movement, deletion, duplication, and layer highlighting
- New, Save, and Open project workflows using portable `.fbd.json` files
- Spring and damper connectors with stiffness, damping, rest-length, and velocity properties
- Automatically derived 2D force balances, constitutive laws, and reduced equations of motion
- Inspector controls for geometry, labels, colors, line width, and force magnitude
- Undo, redo, duplicate, delete, presets, autosave, and keyboard shortcuts
- Clean PNG (2×) and editable SVG export
- Responsive layout with no build step or runtime dependencies

## Math labels

Enter ordinary text or LaTeX-style notation in any label field. Supported examples include
`$F_k$`, `F_{net}`, `v^2`, `\theta`, `\mu N`, `\vec{F}`, `\hat{x}`,
`\sqrt{x}`, and `\frac{a}{b}`. Math remains editable and is preserved in SVG and PNG exports.
