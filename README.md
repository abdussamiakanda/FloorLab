# FloorLab

A 2D floor plan designer built with React, Vite, Firebase (Auth + Firestore), and Google sign-in. Create floor plans with walls, doors, windows, and rooms; customize colors and dimensions; save to the cloud and export to JSON or PNG.

## Tech stack

- **React 19** + **Vite 7**
- **Firebase** (modular SDK): Authentication (Google), Firestore
- **React Router** (protected routes)
- **Lucide React** (icons), **SweetAlert2** (modals)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set all `VITE_FIREBASE_*` variables.

3. In Firebase Console:
   - Enable **Google Authentication**.
   - Create a **Firestore** database.
   - **Firestore Rules**: go to Firestore Database → Rules, paste the contents of `firestore.rules`, then Publish.
   - **Authorized domains**: in Authentication → Settings, add your local URL (e.g. `localhost`) and production domain (e.g. Netlify).

4. Run the app:

   ```bash
   npm run dev
   ```

## Features

### Auth & data

- **Google sign-in** with session persistence.
- **Protected routes**: app and editor require login.
- **User profile** stored at `users/{uid}`.
- **Floor plans** stored at `floorplans/{planId}`; each plan has `name`, `objects`, optional `colors`, and `createdBy` / `createdByName`.

### Dashboard

- List all floor plans with creator info.
- **Create** a new plan (opens in editor).
- **Rename** and **Delete** plans (with confirmation).
- **Open** a plan to edit.

### Editor

- **Left sidebar** (collapsible):
  - **Drawing tools**: Select (V), Wall (W), Door (D), Window (N), Room (R). Click-drag to draw.
  - **Edit**: Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Duplicate (Ctrl+D), Save (Ctrl+S).
  - **View**: Grid, Snap, dimension Labels, Rulers toggles.
  - **Export**: JSON, PNG.
  - **Keyboard shortcuts** button opens a modal with all shortcuts.
- **Legend** (left): color pickers for Wall, Door, Window, Room; colors are saved with the plan.
- **Canvas**: full-size workspace, mouse wheel zoom, middle-button pan, grid, snap-to-grid. Rulers on bottom and right (labels at multiples of 5). Selected object is drawn on top.
- **Right sidebar** (collapsible, resizable):
  - **Objects** list grouped by type: Rooms, Doors, Windows, Walls. Each group can be expanded/collapsed and shows a count.
  - Per object: click to select, visibility (eye), delete, rename. When selected, inline properties: length (wall/door/window) or width/height (room) in grid units.

### Saving & export

- **Autosave**: saves 10 seconds after the last change; each edit resets the timer.
- **Manual save**: Save button or Ctrl+S.
- **Export JSON**: download plan data.
- **Export PNG**: download canvas as image.

## Deployment (Netlify)

- Use the included `netlify.toml` (Vite build + SPA redirect).
- In Netlify Site Settings → Environment variables, add every `VITE_FIREBASE_*` from your `.env`.

## Troubleshooting

**"Missing or insufficient permissions" (Firestore):**  
Apply the project's `firestore.rules` in Firebase Console → Firestore Database → Rules → Publish. The rules restrict access so users can only read/write their own data.
