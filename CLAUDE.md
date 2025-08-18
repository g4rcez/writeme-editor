# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Writeme is an Electron-based note-taking application built with React, TypeScript, and Tiptap editor. The app features a rich text editor with syntax highlighting, math solving capabilities, and clipboard monitoring functionality.

## Common Development Commands

- `npm run dev` / `npm start` - Start the Electron app in development mode
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run package` - Package the application for distribution
- `npm run make` - Build distributables using Electron Forge
- `npm run publish` - Publish the application

## Architecture Overview

### Core Structure
- **Electron Main Process** (`src/main.ts`): Creates BrowserWindow, handles IPC, manages app lifecycle
- **React Renderer Process** (`src/app/main.tsx`): Main React application entry point
- **Preload Script** (`src/preload.ts`): Secure bridge between main and renderer processes

### Key Components
- **Editor** (`src/app/editor.tsx`): Main Tiptap-based rich text editor with clipboard monitoring
- **Global Store** (`src/store/global.store.ts`): Uses `use-typed-reducer` for theme and note state management
- **Database Layer** (`src/store/repositories/dexie/`): Dexie.js for IndexedDB storage of notes and projects

### Data Models
- **Notes**: Stored with id, title, content, project reference, timestamps
- **Projects**: Container for organizing related notes

### Editor Features
- Tiptap extensions for rich text editing
- Syntax highlighting via Shiki
- Math solving capabilities
- Code block support with multiple themes
- Clipboard monitoring for automatic content insertion
- Task list items and suggestions

### Build Configuration
- **Electron Forge**: Main build system with Vite plugin
- **Vite Configs**: Separate configs for main (`vite.main.config.ts`), preload (`vite.preload.config.ts`), and renderer (`vite.renderer.config.ts`) processes
- **Tailwind CSS**: For styling with custom themes (light/dark)

### IPC Communication
- Notes operations handled through IPC handlers in `src/ipc/notes.ipc.ts`
- Copy events managed through custom event system

### Key Dependencies
- **Tiptap**: Rich text editor framework
- **Dexie**: IndexedDB wrapper for local storage
- **React Query**: Data fetching and caching
- **React Router**: Client-side routing
- **Radix UI**: Accessible UI components
- **Lucide React**: Icon library

## Development Notes

The application follows a typical Electron architecture with clear separation between main and renderer processes. The editor is the central feature, built around Tiptap with extensive customization. Local data persistence uses IndexedDB through Dexie, supporting offline-first functionality.

Theme switching is handled through CSS classes and custom theme objects. The app supports both light and dark themes with smooth transitions.