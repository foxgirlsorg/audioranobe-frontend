import { domToJpeg } from 'modern-screenshot';

/** Design width (px) from a shadow card's `:host { width: … }`, else null. */
function hostDesignWidth(styleText: string): number | null {
  const m = styleText.match(/:host\s*\{[^}]*?\bwidth\s*:\s*(\d+(?:\.\d+)?)px/i);
  return m ? parseFloat(m[1]) : null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Capture a shadow-root card (admin-authored HTML/CSS) via a NATIVE
 * SVG-foreignObject → canvas snapshot, at the card's own design width.
 *
 * Why not modern-screenshot here: it re-lays-out the card in its own way and
 * on some systems the card comes out narrower than designed, so tight lines
 * wrap and overlap. A plain foreignObject of the same markup uses the page's
 * real layout and fonts, so the export matches the on-screen card exactly. The
 * design width also means a phone-clamped on-screen card still exports full
 * size. (Trade-off: a foreignObject image can't fetch external `<img>`/CSS
 * URLs; the recap card is self-contained — gradients + text — so that's fine.)
 */
async function captureShadowCard(node: HTMLElement, bg: string): Promise<string> {
  const sr = node.shadowRoot!;
  const styleText = Array.from(sr.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  const markup = Array.from(sr.children)
    .filter((el) => el.tagName !== 'STYLE')
    .map((el) => el.outerHTML)
    .join('');
  const width = hostDesignWidth(styleText) ?? (node.getBoundingClientRect().width || node.offsetWidth);

  // Real-DOM wrapper at the design width so the browser computes the correct
  // height (aspect-ratio and all) before we serialize.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;top:0;left:-99999px;margin:0;width:${width}px;`;
  wrapper.innerHTML = `<style>${styleText}</style>${markup}`;
  document.body.appendChild(wrapper);

  try {
    try {
      await document.fonts?.ready;
    } catch {
    }

    // Flatten to a flush rectangle so the JPEG has no rounded corners/seam.
    wrapper.querySelectorAll<HTMLElement>(':scope > :not(style)').forEach((el) => {
      el.style.borderRadius = '0';
      el.style.border = 'none';
      el.style.boxShadow = 'none';
    });

    const height = wrapper.offsetHeight;
    const scale = Math.max(2, Math.ceil(1920 / Math.max(1, height)));

    const xhtml =
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;box-sizing:border-box;">` +
      wrapper.innerHTML +
      `</div>`;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    wrapper.remove();
  }
}

/** Render a DOM node to a JPEG data URL. A shadow-root card is captured
 *  natively (see captureShadowCard); any other node goes through
 *  modern-screenshot on a clone (which embeds external images), never mutating
 *  the live node. `bg` fills the canvas behind the render. */
export async function renderNodeToJpeg(node: HTMLElement, bg = '#151517'): Promise<string> {
  if (node.shadowRoot) {
    return captureShadowCard(node, bg);
  }

  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.borderRadius = '0';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '-99999px';
  clone.style.margin = '0';
  document.body.appendChild(clone);
  try {
    try {
      await document.fonts?.ready;
    } catch {
    }
    const width = clone.offsetWidth;
    const height = clone.offsetHeight;
    const scale = Math.max(2, Math.ceil(1920 / Math.max(1, height)));
    return await domToJpeg(clone, {
      width,
      height,
      scale,
      quality: 0.9,
      backgroundColor: bg,
      features: { restoreScrollPosition: true },
    });
  } finally {
    clone.remove();
  }
}

/** Render a node to a JPEG and trigger a download. */
export async function downloadNodeJpg(node: HTMLElement, filename: string, bg = '#151517'): Promise<void> {
  const dataUrl = await renderNodeToJpeg(node, bg);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
  a.click();
}
