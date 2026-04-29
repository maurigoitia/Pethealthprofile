/**
 * PWA Install Prompt Utility
 *
 * Captures the browser's `beforeinstallprompt` event so the app can trigger
 * the native install dialog programmatically at any time.
 *
 * Usage:
 *   import { canInstallPwa, promptPwaInstall } from '@/app/utils/pwaInstall';
 *
 *   if (canInstallPwa()) {
 *     // show your custom "Install" button
 *     await promptPwaInstall();
 *   }
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
  });
}

/** Returns `true` when the browser allows showing the install prompt. */
export function canInstallPwa(): boolean {
  return deferredPrompt !== null && !installed;
}

/** Returns `true` if the app was already installed during this session. */
export function isPwaInstalled(): boolean {
  return installed;
}

/**
 * Triggers the native install dialog.
 * Resolves to `true` if the user accepted, `false` otherwise.
 */
export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  deferredPrompt = null;
  return outcome === 'accepted';
}
