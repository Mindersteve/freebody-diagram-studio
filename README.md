# Freebody Diagram Studio

A zero-dependency, browser-based editor for drawing, annotating, and exporting free body diagrams.

## Use the app

Open **[Freebody Diagram Studio](https://mindersteve.github.io/freebody-diagram-studio/)**.
There is nothing to install, and it works on macOS, Windows, Linux, tablets, and
modern mobile browsers.

## Run from source

Install [Node.js 22 or newer](https://nodejs.org/), then:

```bash
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173).

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
