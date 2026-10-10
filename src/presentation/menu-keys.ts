const previousKeys = new Set(['ArrowUp', 'ArrowLeft']);
const nextKeys = new Set(['ArrowDown', 'ArrowRight']);
const chooseKeys = new Set(['z', 'x', ' ', 'Enter']);

export function focusAfter(key: string, focused: number, count: number): number {
  if (previousKeys.has(key)) return Math.max(0, focused - 1);
  if (nextKeys.has(key)) return Math.min(count - 1, focused + 1);
  return focused;
}

export function menuChoices(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>('button')].filter((button) => !button.hidden && !button.disabled);
}

// The game's own keys move the hero and press A and B, so an open menu takes them first. Choosing can open the
// other menu, whose listener sits on the same document, so no later listener may handle the same key again.
export function takeMenuKeys(root: Document, menu: HTMLElement): void {
  root.addEventListener(
    'keydown',
    (event) => {
      if (menu.hidden) return;
      const choices = menuChoices(menu);
      const focused = choices.findIndex((choice) => choice === root.activeElement);
      if (chooseKeys.has(event.key.length === 1 ? event.key.toLowerCase() : event.key)) {
        if (!event.repeat) choices[focused]?.click();
      } else if (previousKeys.has(event.key) || nextKeys.has(event.key)) {
        choices[focusAfter(event.key, Math.max(0, focused), choices.length)]?.focus();
      } else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}
