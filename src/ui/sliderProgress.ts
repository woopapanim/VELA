/**
 * Global helper that sets a `--_p` CSS variable on every <input type="range">
 * reflecting its current progress percentage. Used by index.css to render
 * the blue "filled" portion of the track on webkit (Firefox uses native
 * ::-moz-range-progress instead).
 */

function updateSlider(el: HTMLInputElement) {
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const val = Number(el.value || 0);
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--_p', `${pct}%`);
}

function updateAll() {
  document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(updateSlider);
}

export function installSliderProgress() {
  // Sync on all input/change events (event bubbles from range inputs)
  const onInput = (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (t && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range') {
      updateSlider(t as HTMLInputElement);
    }
  };
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onInput, true);

  // Observe DOM for new sliders appearing (React re-renders, route changes)
  const observer = new MutationObserver(() => updateAll());
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'min', 'max'] });

  // Initial sync
  updateAll();
}
