export function element<T extends HTMLElement>(root: Document, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`The page has no ${selector}`);
  return found;
}
