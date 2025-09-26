# WakeLock Demo

A minimal React + Vite experience that demonstrates how to keep a mobile screen awake while recording audio in the browser. The demo coordinates MediaRecorder, the Screen Wake Lock API, and various mobile-specific workarounds so you can test long-running field recordings without your device going to sleep.

## Features

- **Screen wake lock orchestration** – requests the wake lock as soon as the session starts and re-acquires it on visibility changes.
- **Mobile-friendly audio recorder** – wraps `MediaRecorder` with sensible feature detection and codec fallbacks for iOS and Android.
- **Downloadable artifacts** – exposes completed recordings as blobs so testers can save or inspect captured audio.
- **Optional signature pad** – includes a responsive drawing surface component that showcases touch handling and orientation locking patterns.

## Quick Start

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
2. Run the Vite dev server:
   ```bash
   npm run dev
   ```
3. Open the printed URL on a mobile device (ensure you are on the same network). Allow microphone access when prompted, then tap **Start Recording**. The wake lock indicator in the UI shows whether the screen lock is held.

> **Tip:** The project includes `@vitejs/plugin-basic-ssl`. Start Vite with `npm run dev -- --https` if you need HTTPS for certain APIs on iOS.

## Usage Notes

- The first tap on **Start Recording** triggers both microphone permission and the wake lock request. If microphone access is denied the wake lock is immediately released.
- Keep the demo tab in the foreground; backgrounding the page may release the wake lock. The app re-requests it when the tab becomes visible again.
- Finished recordings appear in the player at the bottom of the card. Use the provided download link to export the audio (`.webm` or `.m4a`, depending on codec support).
- To experiment with the signature pad component, import `SignaturePad` in `src/App.jsx` and render it alongside or instead of the recorder.

## Project Structure

```text
src/
├── App.jsx             # Entry point that renders the recorder (and optional extras)
├── WakeLockRecorder.tsx# Coordinates MediaRecorder + wake lock lifecycle
├── SignaturePad.tsx    # Standalone canvas-based signature/drawing pad
├── App.css             # Basic global styles
└── global.d.ts         # TypeScript shims for browser APIs
```

## Available Scripts

- `npm run dev` – start a local development server with hot module reload.
- `npm run build` – create a production build in `dist/`.
- `npm run preview` – serve the production build locally.
- `npm run lint` – run ESLint with the project configuration.
- `npm run test` – execute the Vitest suite (WakeLock recorder and SignaturePad coverage).

## Testing

The project uses [Vitest](https://vitest.dev/) with React Testing Library. The current suite covers:

- Wake lock + recorder lifecycle, ensuring permissions, wake-lock acquisition, and cleanup all behave correctly.
- Signature pad interactions, validating pointer drawing, undo/clear behaviour, orientation guards, and PNG export callback wiring.

Run everything locally with:

```bash
npm run test
```

Vitest runs in a jsdom environment that includes mocked wake-lock, media, and canvas APIs—no additional browser setup required.

## Troubleshooting

- **Wake lock not acquired** – confirm the page is served over HTTPS and the device stays in the foreground. Some devices require a charger to be connected for wake locks.
- **Recorder fails to start** – verify that the browser supports `MediaRecorder` and the chosen MIME type. The UI surfaces the underlying error message in the status banner.
- **Permission prompts repeat** – clear the site data or change permissions in your browser settings; the demo requests microphone access each time the browser reports it as needed.

## Roadmap Ideas

- Add UI controls for wake lock toggling and recording quality.
- Surface the signature pad in the main demo with export tooling.
- Package the recorder logic as a reusable hook for other projects.

## License

No license has been specified yet. Add your preferred license file before distributing this code.
