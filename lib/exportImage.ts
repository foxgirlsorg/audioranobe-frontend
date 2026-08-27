import { domToJpeg } from 'modern-screenshot';

/** Render a DOM node (incl. shadow DOM) to a JPEG and download it. The exported
 *  image is flattened to a flush rectangle — no border, rounded corners, or
 *  shadow — so it sits clean in a share sheet. `bg` fills the canvas behind the
 *  render so a clipped edge can't leave a lighter antialiased seam. */
export async function downloadNodeJpg(node: HTMLElement, filename: string, bg = '#151517'): Promise<void> {
  const width = node.offsetWidth;
  const height = node.offsetHeight;

  const clone = node.cloneNode(true) as HTMLElement;
  if (node.shadowRoot) {
    clone.attachShadow({ mode: 'open' }).innerHTML = node.shadowRoot.innerHTML;
  }
  const flatten = (el: HTMLElement) => {
    el.style.borderRadius = '0';
    el.style.border = 'none';
    el.style.boxShadow = 'none';
  };
  flatten(clone);
  if (clone.shadowRoot) {
    clone.shadowRoot.querySelectorAll<HTMLElement>(':scope > *:not(style)').forEach(flatten);
  }
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '-99999px';
  clone.style.margin = '0';
  document.body.appendChild(clone);

  try {
    // Use the integer layout box, not getBoundingClientRect: a fractional size
    // leaves a 1px strip and clips the aspect-ratio height (which the cloner
    // does not infer). offsetWidth/Height match the element exactly.
    const MIN_HEIGHT = 1920;
    const scale = Math.max(2, Math.ceil(MIN_HEIGHT / height));
    const dataUrl = await domToJpeg(clone, {
      width,
      height,
      scale,
      quality: 0.9,
      backgroundColor: bg,
      features: { restoreScrollPosition: true },
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
    a.click();
  } finally {
    clone.remove();
  }
}
