let locks = 0;

/** Ref-counted body scroll lock, so overlays closing out of order can't leave the page stuck. */
export function lockScroll(): () => void {
  if (locks++ === 0) document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = '';
  };
}
