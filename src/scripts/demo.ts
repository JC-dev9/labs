import { SOURCES } from "../data/sources";

// Hero demo: rotates every 4.5s until the visitor picks a tab. The answer
// types itself out; rotation pauses while off-screen or in a background tab.
const ROTATE_MS = 4500;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const demo = document.querySelector<HTMLElement>("[data-demo]");
if (demo) {
  const tabs = [...demo.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const refEls = demo.querySelectorAll("[data-ref]");
  const excerptEl = demo.querySelector("[data-excerpt]")!;
  const qEl = demo.querySelector("[data-q]")!;
  const aEl = demo.querySelector("[data-a]")!;
  const swapEls = demo.querySelectorAll(".swap");
  const tablist = demo.querySelector<HTMLElement>(".tabs")!;
  const pill = demo.querySelector<HTMLElement>("[data-tab-pill]");

  let active = 0;
  let paused = false;
  let visible = true;
  let rotateTimer = 0;
  let typeTimer = 0;
  let swapTimer = 0;

  const typeAnswer = (text: string) => {
    clearInterval(typeTimer);
    if (reduceMotion) { aEl.textContent = text; return; }
    let n = 0;
    const step = Math.max(2, Math.ceil(text.length / 60)); // ~1.3s whatever the length
    aEl.textContent = "";
    aEl.classList.add("typing-now");
    typeTimer = window.setInterval(() => {
      n = Math.min(text.length, n + step);
      aEl.textContent = text.slice(0, n);
      if (n >= text.length) { clearInterval(typeTimer); aEl.classList.remove("typing-now"); }
    }, 22);
  };

  // Sliding pill behind the active tab
  const movePill = () => {
    if (!pill) return;
    const t = tabs[active];
    pill.style.width = `${t.offsetWidth}px`;
    pill.style.transform = `translateX(${t.offsetLeft}px)`;
  };
  if (pill) {
    tablist.classList.add("has-pill");
    movePill();
    new ResizeObserver(movePill).observe(tablist);
    document.fonts.ready.then(movePill);
  }

  const runBar = () => {
    tabs.forEach(t => t.classList.remove("run"));
    if (paused || reduceMotion) return;
    void tabs[active].offsetWidth; // restart the CSS progress animation
    tabs[active].classList.add("run");
  };

  const schedule = () => {
    clearTimeout(rotateTimer);
    if (paused || !visible || document.hidden) return;
    rotateTimer = window.setTimeout(() => show((active + 1) % SOURCES.length), ROTATE_MS);
  };

  const show = (i: number) => {
    active = i;
    tabs.forEach((t, j) => t.setAttribute("aria-selected", String(j === i)));
    movePill();
    runBar();
    const s = SOURCES[i];
    clearTimeout(swapTimer);
    swapEls.forEach(el => el.classList.add("out"));
    swapTimer = window.setTimeout(() => {
      refEls.forEach(el => { el.textContent = s.ref; });
      excerptEl.textContent = s.excerpt;
      qEl.textContent = s.q;
      typeAnswer(s.a);
      swapEls.forEach(el => el.classList.remove("out"));
    }, reduceMotion ? 0 : 220);
    schedule();
  };

  // Back in view: restart the countdown without retyping the answer
  const resume = () => { runBar(); schedule(); };

  tabs.forEach((t, i) => t.addEventListener("click", () => { paused = true; show(i); }));

  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (visible && !was) resume();
    else if (!visible) clearTimeout(rotateTimer);
  }).observe(demo);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(rotateTimer); else resume();
  });

  // First answer is server-rendered; start the clock once the intro has landed
  window.setTimeout(resume, reduceMotion ? 0 : 1600);
}
