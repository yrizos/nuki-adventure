// Closing the tab or the browser hides the page first, so the level is saved before it can be lost.
export function watchPageLifecycle(
  root: Document,
  target: Window,
  whenHidden: () => void,
  whenVisible: () => void,
): void {
  root.addEventListener('visibilitychange', () => {
    if (root.visibilityState === 'hidden') whenHidden();
    else whenVisible();
  });
  target.addEventListener('pagehide', () => whenHidden());
}
