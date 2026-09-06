/**
 * Scroll reveal for .dayfade blocks. Each block waits, invisible, until it
 * enters the viewport, then plays the app's dayIn entrance. Blocks that
 * arrive in the same frame (everything above the fold on load, a section
 * and its cards scrolled into view together) stagger 90ms apart in DOM
 * order, so the page unfolds instead of popping. Attach as a ref.
 */
const STEP = 90;
let io: IntersectionObserver | null = null;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function observer(): IntersectionObserver {
  return io ||= new IntersectionObserver(entries => {
    const hit = entries.filter(e => e.isIntersecting).map(e => e.target as HTMLElement)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    hit.forEach((el, i) => {
      el.style.animationDelay = `${i * STEP}ms`;
      el.classList.add('in');
      io!.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
}

export function reveal(el: HTMLElement | null) {
  if (!el || el.classList.contains('in')) return;
  if (reduced() || !('IntersectionObserver' in window)) { el.classList.add('in'); return; }
  observer().observe(el);
}
