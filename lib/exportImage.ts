import { domToJpeg } from 'modern-screenshot';

/** Render a DOM node (incl. shadow DOM) to a JPEG and download it. The exported
 *  image is flattened to a flush rectangle — no border, rounded corners, or
 *  shadow — so it sits clean in a share sheet. `bg` fills the canvas behind the
 *  render so a clipped edge can't leave a lighter antialiased seam. */
export async function downloadNodeJpg(node: HTMLElement, filename: string, bg = '#151517'): Promise<void> {
  // modern-screenshot's `style` option only touches a wrapper, so set the flat
  // styles inline on the node itself. For a shadow-hosted card (the admin
  // template) the visible corners live on the shadow's own top-level element,
  // so flatten those too. Everything is restored afterwards.
  const restore: (() => void)[] = [];
  const flatten = (el: HTMLElement) => {
    const p = { br: el.style.borderRadius, bd: el.style.border, sh: el.style.boxShadow };
    el.style.borderRadius = '0';
    el.style.border = 'none';
    el.style.boxShadow = 'none';
    restore.push(() => {
      el.style.borderRadius = p.br;
      el.style.border = p.bd;
      el.style.boxShadow = p.sh;
    });
  };

  flatten(node);
  if (node.shadowRoot) {
    node.shadowRoot.querySelectorAll<HTMLElement>(':scope > *:not(style)').forEach(flatten);
  }

  try {
    // Use the integer layout box, not getBoundingClientRect: a fractional size
    // leaves a 1px strip and clips the aspect-ratio height (which the cloner
    // does not infer). offsetWidth/Height match the element exactly.
    const MIN_HEIGHT = 1920;
    const scale = Math.max(2, Math.ceil(MIN_HEIGHT / node.offsetHeight));
    const dataUrl = await domToJpeg(node, {
      width: node.offsetWidth,
      height: node.offsetHeight,
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
    restore.forEach((f) => f());
  }
}
