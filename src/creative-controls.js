// Photo mode is temporary presentation state; it never changes the saved town.
export function createCreativeControls(api) {
  const shell = document.querySelector('.game-shell');
  const bar = document.getElementById('photoModeBar');
  const button = document.getElementById('photoModeButton');
  const exitButton = document.getElementById('photoModeExitButton');
  let active = false;
  let previousPaused = false;
  let previousFocus = null;
  function enter() {
    if (active || !api.canEnter()) return false;
    previousPaused = api.getPaused();
    previousFocus = document.activeElement;
    window.sunnyTownUI?.closeSaveMenu();
    active = true;
    api.setPaused(true);
    document.body.classList.add('is-photo-mode');
    shell.inert = true;
    bar.hidden = false;
    exitButton.focus({ preventScroll: true });
    api.onChange?.(true);
    return true;
  }
  function exit({ restorePause = true } = {}) {
    if (!active) return false;
    active = false;
    document.body.classList.remove('is-photo-mode');
    shell.inert = false;
    bar.hidden = true;
    if (restorePause) api.setPaused(previousPaused);
    api.onChange?.(false);
    (previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : button)?.focus({ preventScroll: true });
    return true;
  }
  const toggle = () => active ? exit() : enter();
  button?.addEventListener('click', toggle);
  exitButton?.addEventListener('click', () => exit());
  // Capture the exit key before the simulation's ordinary shortcut handler.
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable=true]')) return;
    if ((active && event.key === 'Escape') || event.key.toLowerCase() === 'p') {
      if (!active && !api.canEnter()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      toggle();
    } else if (active && !['c', 'C', '+', '=', '-', '_', 'Tab', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  return { enter, exit, isActive: () => active };
}
