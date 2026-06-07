# MiraBox Controller

MiraBox Controller is a React, TypeScript, and Electron desktop application for configuring and controlling a **MiraBox HSV 293S Stream Deck** on Windows.

The app provides a desktop interface for customizing Stream Deck keys, uploading images, assigning actions, changing pages, and sending the final key layout to the connected MiraBox device.

## Features

- Customize Stream Deck keys from a desktop UI.
- Upload key images from local files.
- Assign actions such as opening URLs, launching applications, running shell commands, and moving between pages.
- Detect the connected MiraBox Stream Deck device.
- Send key images and labels to the physical device.
- Build a Windows installer or a portable executable with Electron Builder.

## Tech Stack

- **React** for the user interface.
- **TypeScript** for application code.
- **Material UI** for UI components.
- **Vite** for the renderer build.
- **Electron** for the desktop shell.
- **Electron Builder** for Windows packaging.
- **node-hid** for USB HID communication with the MiraBox device.
- **sharp** for image processing.

## Project Structure

```text
electron/
  main.ts                 Electron main process
  preload.ts              Secure bridge between Electron and React
  streamdock.ts           MiraBox device communication
  streamdock-types.ts     Device-related TypeScript types
  key-image.ts            Key image processing
  panel-image.ts          Panel image processing

src/
  App.tsx                 Main React layout
  components/             React components
  context/                Stream Deck state and actions
  utils/                  Shared utility functions

public/
  assets/                 App icons and static assets

release/                  Generated installers and packaged builds
dist/                     Production build output
```

## Requirements

- Windows 10 or newer.
- Node.js installed.
- npm installed.
- A MiraBox HSV 293S Stream Deck device for full hardware testing.

This project is configured to build a Windows **x64** installer. The x64 installer works on Intel and AMD Windows computers. It can also run on Windows ARM devices, such as Snapdragon X Elite PCs, through Windows x64 emulation.

## Install Dependencies

Install the project dependencies before running or building the app:

```bash
npm install
```

## Development

To run only the Vite web development server:

```bash
npm run dev
```

To run the full Electron desktop app in development mode:

```bash
npm run dev:electron
```

The Electron development command starts the Vite server, builds the Electron main and preload scripts in watch mode, waits for all required files to be ready, and then opens the desktop app.

## Production Build

To build the React renderer only:

```bash
npm run build
```

To build the Electron main and preload scripts only:

```bash
npm run build:electron
```

To build the full app and run it locally with Electron:

```bash
npm run electron
```

## Build the Windows Installer

Use this command to create a Windows installer:

```bash
npm run dist:win
```

This command runs the production build, builds the Electron files, and packages the app with Electron Builder using the NSIS installer target.

After the command finishes, the installer will be created in:

```text
release/
```

The generated installer is the file you can share with users. When the user runs it, Windows installs **MiraBox Controller** like a normal desktop application.

## Build a Portable Executable

Use this command if you want a portable app instead of an installer:

```bash
npm run dist:portable
```

The portable build is also created in:

```text
release/
```

A portable executable can run without a traditional installation step, but the NSIS installer is usually better for regular users because it handles installation and future replacement more naturally.

## Releasing a New Version

Before creating a new installer, update the `version` field in `package.json`:

```json
{
  "version": "0.1.0"
}
```

Then build the installer again:

```bash
npm run dist:win
```

Because the app uses a stable Electron Builder `appId`, the new installer should recognize the previous installation and replace it with the new version:

```json
{
  "appId": "com.mirabox.controller.rbd"
}
```

This project does not currently include automatic in-app updates. Users need to run the newer installer manually to update an existing installation.

## Windows Architecture Notes

The current package configuration builds the Windows installer for:

```json
"arch": ["x64"]
```

Use this build for Intel and AMD Windows computers. If you want to generate a native Windows ARM64 build for Snapdragon devices, update the architecture list in `package.json`:

```json
"arch": ["x64", "arm64"]
```

Then run:

```bash
npm run dist:win
```

## Build Configuration

The installer configuration lives in `package.json` under the `build` field. Important values include:

- `appId`: the stable application identifier used by Electron Builder.
- `productName`: the installed app name shown to users.
- `directories.output`: the folder where packaged files are created.
- `files`: the files included in the packaged app.
- `asarUnpack`: native dependencies that need to remain unpacked.
- `win.target`: the Windows packaging target.
- `win.icon`: the application icon used for the Windows build.

## Useful Commands

```bash
npm install
npm run dev
npm run dev:electron
npm run build
npm run build:electron
npm run electron
npm run dist:win
npm run dist:portable
npm run lint
```

## References

This project uses the [mirabox-streamdeck-node](https://github.com/mirabox/mirabox-streamdeck-node) repository as a reference implementation for MiraBox Stream Deck communication and protocol behavior.

## License

This project was created by Rodrigo Bazan Danino and is released under a free license.

You are free to use, study, modify, and share this project. For formal distribution, add a dedicated `LICENSE` file with the exact license terms you want to apply.
