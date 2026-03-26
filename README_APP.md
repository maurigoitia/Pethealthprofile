# Pessy PWA Application

This branch contains the full React PWA application for Pessy, built with Vite and TypeScript.

## Contents

- `src/` - React application source code
- `public/` - Static assets and public files
- `functions/` - Firebase Cloud Functions backend
- `index.html` - Main HTML entry point
- `vite.config.ts` - Vite build configuration
- `package.json` - Node dependencies
- `firebase.json` - Firebase hosting configuration
- `.firebaserc` - Firebase project configuration
- `capacitor.config.ts` - Capacitor (native wrapper) configuration

## Getting Started

Install dependencies:
```bash
npm install
```

Start development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Deploy to Firebase Hosting:
```bash
npm run deploy
```

## Architecture

- **Frontend**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + custom CSS
- **Backend**: Firebase (Firestore, Auth, Functions)
- **PWA**: Service Worker for offline support
- **Mobile**: Capacitor for iOS/Android wrapping

## Features

- Pet health profile management
- Medical records and appointments tracking
- Vaccination management
- Health reports and analytics
- Reminders and notifications
- User authentication and authorization
- Data export and PDF generation
