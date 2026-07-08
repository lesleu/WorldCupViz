/**
 * Unit checks for homepage scroll offset math.
 * Run: npx tsx scripts/test-home-scroll-logic.ts
 */

type Rect = { top: number; left: number; width: number; height: number };

function scrollOffsetInScroller(
  element: { getBoundingClientRect: () => Rect },
  scroller: { getBoundingClientRect: () => Rect; scrollTop: number }
): number {
  return (
    element.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testScrollOffsetInScroller(): void {
  const scroller = {
    scrollTop: 500,
    getBoundingClientRect: () => ({ top: 100, left: 0, width: 400, height: 800 }),
  };
  const section = {
    getBoundingClientRect: () => ({ top: 250, left: 0, width: 400, height: 600 }),
  };

  const offset = scrollOffsetInScroller(section, scroller);
  assert(offset === 650, `expected 650, got ${offset}`);
}

function testAnchorOffsetRoundTrip(): void {
  const scroller = {
    scrollTop: 1200,
    getBoundingClientRect: () => ({ top: 80, left: 0, width: 400, height: 900 }),
  };
  const section = {
    getBoundingClientRect: () => ({ top: 180, left: 0, width: 400, height: 700 }),
  };

  const sectionTop = scrollOffsetInScroller(section, scroller);
  const anchorOffset = scroller.scrollTop - sectionTop;
  const restored = sectionTop + anchorOffset;

  assert(
    Math.abs(restored - scroller.scrollTop) < 0.01,
    `round-trip failed: ${restored} vs ${scroller.scrollTop}`
  );
}

testScrollOffsetInScroller();
testAnchorOffsetRoundTrip();

console.log("home scroll logic tests passed");
