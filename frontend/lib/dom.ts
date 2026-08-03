/** Mobile browsers keep the on-screen keyboard open after a form submit unless the
 * focused input is explicitly blurred - this dismisses it. */
export function blurActiveElement(): void {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
