# Freebody Diagram Studio

A zero-dependency, browser-based editor for drawing, annotating, and exporting free body diagrams.

## Download and run

1. Open the **[latest release](https://github.com/Mindersteve/freebody-diagram-studio/releases/latest)**.
2. Download `Freebody-Diagram-Studio-1.1.0.zip`.
3. Extract the ZIP.
4. Double-click `index.html`.

The app opens locally in your default browser on macOS, Windows, or Linux.
There is nothing to install and no internet connection is required.

## Run from source

Install [Node.js 22 or newer](https://nodejs.org/), then:

```bash
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173).

## Features

- Rectangle, rounded, elliptical, triangular, hexagonal, and freehand rigid bodies
- Force vectors, clockwise/counterclockwise torque arrows, inclined surfaces, dimensions, coordinate axes, and text
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
- Automatically derived 2D force balances and moment balances about a selectable origin, labeled point, or body center
- Constitutive laws and reduced equations of motion
- Inspector controls for geometry, labels, colors, line width, and force magnitude
- Undo, redo, duplicate, delete, presets, autosave, and keyboard shortcuts
- Clean PNG (2×) and editable SVG export
- Responsive layout with no build step or runtime dependencies

## Math labels

Enter ordinary text or LaTeX-style notation in any label field. Supported examples include
`$F_k$`, `F_{net}`, `v^2`, `\theta`, `\mu N`, `\vec{F}`, `\hat{x}`,
`\sqrt{x}`, and `\frac{a}{b}`. Math remains editable and is preserved in SVG and PNG exports.
