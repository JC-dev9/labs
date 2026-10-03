import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrollToPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------- Motion budget ----------
   full   : desktop with a mouse — everything, plus Lenis smooth scrolling
   lite   : touch or weak hardware — native scroll, no cursor, no clip-path scenes
   gentle : html.rm (only if RESPECT_REDUCED_MOTION is on in Base.astro) — fades only

   Performance rules: boot does the minimum (intro + hero). Everything below the
   fold is prepared when it approaches the viewport, or in small idle chunks, so
   the main thread never blocks for long on a slow phone. */
const root = document.documentElement;
const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
const gentle = root.classList.contains("rm");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const lowEnd = (nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4 || !!nav.connection?.saveData;
const lite = !finePointer || lowEnd;
root.classList.toggle("lite", lite);
root.classList.add("motion"); // CSS hidden states only apply once this script runs

const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => el.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => [...el.querySelectorAll<T>(sel)];

const EASE = "expo.out";
const HEADER_OFFSET = 72;

/* ---------- Scheduling helpers ---------- */

// Run each task in its own idle slot (or a short timeout where unsupported)
function idleChunks(tasks: Array<() => void>) {
  const ric = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 16));
  const next = () => {
    const task = tasks.shift();
    if (!task) return;
    ric(() => { task(); next(); }, { timeout: 500 } as IdleRequestOptions);
  };
  next();
}

// Fire once when an element comes into view (bottom margin = how early)
const viewObservers = new Map<string, IntersectionObserver>();
function onView(el: Element, cb: () => void, margin = "0px 0px -12% 0px") {
  let io = viewObservers.get(margin);
  if (!io) {
    io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io!.unobserve(e.target);
        (e.target as Element & { __onView?: () => void }).__onView?.();
      }
    }, { rootMargin: margin });
    viewObservers.set(margin, io);
  }
  (el as Element & { __onView?: () => void }).__onView = cb;
  io.observe(el);
}

/* ---------- Boot ---------- */
let lenis: Lenis | null = null;
if (!gentle && !lite) {
  // Smooth wheel scrolling on desktop only; touch already has native momentum
  lenis = new Lenis({ autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

headerState();
anchors();
reveals();

if (gentle) {
  root.classList.add("ready");
} else {
  logoIntro().then(played => heroIntro(played));
}

idleChunks([
  activeNav,
  ...(gentle ? [] : [heroOut, marquee, expandSections, contactGlow, footerWord, howItWorks, caseShowcase]),
  ...(finePointer && !gentle ? [magnetic, cursor] : []),
]);

/* ---------- Logo intro: the pillar rises, the sun rises, the mark flies home ----------
   Once per session. Click or any key fast-forwards it. Resolves when the curtain
   starts lifting, so the hero animates in underneath it. */
function logoIntro(): Promise<boolean> {
  const intro = $("[data-intro]");
  const remove = () => { intro?.remove(); };
  if (!intro || root.classList.contains("no-intro")) { remove(); return Promise.resolve(false); }

  const mark = $<SVGElement>("[data-intro-mark]", intro)!;
  const pillar = $("[data-intro-pillar]", intro)!;
  const sun = $("[data-intro-sun]", intro)!;
  const glow = $("[data-intro-glow]", intro)!;
  const word = $("[data-intro-word]", intro)!;
  const target = $(".brand svg");

  intro.style.animation = "none"; // JS is alive: cancel the CSS failsafe
  lenis?.stop();
  try { sessionStorage.setItem("bl-intro", "1"); } catch {}

  const fontsOrTimeout = Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 700))]);

  return fontsOrTimeout.then(() => new Promise<boolean>(resolve => {
    const chars = SplitText.create(word.children, { type: "chars" }).chars;
    gsap.set([pillar, sun, glow, word], { opacity: 1 });

    const tl = gsap.timeline({
      defaults: { ease: "expo.out" },
      onComplete: () => { remove(); lenis?.start(); off(); },
    });

    tl.fromTo(pillar, { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: .75, ease: "expo.inOut" })
      .fromTo(sun, { y: 26, scale: .6, opacity: 0, transformOrigin: "50% 50%" }, { y: 0, scale: 1, opacity: 1, duration: 1 }, "-=.2")
      .fromTo(glow, { scale: .2, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1.6, opacity: 1, duration: 1.2, ease: "power2.out" }, "<")
      .from(chars, { yPercent: 110, opacity: 0, duration: .7, stagger: .035 }, "-=.85")
      .addLabel("fly", "+=.15");

    // Fly the mark onto the header logo (FLIP), measured when the flight starts
    tl.add(() => {
      if (!target) return;
      const a = mark.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      gsap.to(mark, {
        x: b.left + b.width / 2 - (a.left + a.width / 2),
        y: b.top + b.height / 2 - (a.top + a.height / 2),
        scale: b.width / a.width,
        duration: .95 / tl.timeScale(),
        ease: "expo.inOut",
      });
    }, "fly")
      .to(glow, { opacity: 0, duration: .4, ease: "power2.in" }, "fly")
      .to(word, { y: -14, opacity: 0, duration: .45, ease: "power2.in" }, "fly")
      .call(() => resolve(true), [], "fly+=.45")
      // The curtain lifts from the bottom, revealing the site under the flying mark
      .to(intro, { clipPath: "inset(0% 0% 100% 0%)", duration: .9, ease: "expo.inOut" }, "fly+=.35");

    // Impatient? Any click or key plays the rest at 4x
    const skip = () => tl.timeScale(4);
    const off = () => { removeEventListener("pointerdown", skip); removeEventListener("keydown", skip); };
    addEventListener("pointerdown", skip, { once: true });
    addEventListener("keydown", skip, { once: true });
  }));
}

/* ---------- Header: gains depth, hides on the way down ---------- */
function headerState() {
  const header = $("[data-header]");
  if (!header) return;
  let lastY = scrollY;
  let queued = false;
  const update = () => {
    queued = false;
    const y = scrollY;
    header.classList.toggle("scrolled", y > 8);
    // Only change on real movement: Lenis can fire repeat events at the same y
    if (Math.abs(y - lastY) < 3) return;
    header.classList.toggle("hide", !gentle && y > 400 && y > lastY);
    lastY = y;
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------- Nav: underline follows the section you're reading ---------- */
function activeNav() {
  $$<HTMLAnchorElement>(".nav a[href^='#']:not(.nav-cta)").forEach(link => {
    const section = $(link.hash);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 45%",
      end: "bottom 45%",
      onToggle: self => link.classList.toggle("is-active", self.isActive),
    });
  });
}

/* ---------- In-page links: one long cinematic glide ---------- */
function anchors() {
  const expoInOut = (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;

  document.addEventListener("click", e => {
    const link = (e.target as Element).closest<HTMLAnchorElement>("a[href^='#']");
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const target = link.hash === "#topo" ? document.body : $(link.hash);
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, "", link.hash);
    const arrive = () => { if (link.hash === "#contacto") inviteToForm(); };
    const dist = Math.abs(target.getBoundingClientRect().top);
    const duration = gentle ? .8 : Math.min(2, Math.max(.9, dist / 2400));

    if (lenis) {
      // sections carry scroll-margin-top for the header, which Lenis honours
      lenis.scrollTo(target, { offset: 0, duration, easing: expoInOut, onComplete: arrive });
    } else {
      gsap.to(window, {
        scrollTo: { y: target === document.body ? 0 : target, offsetY: HEADER_OFFSET },
        duration,
        ease: gentle ? "power2.inOut" : "expo.inOut",
        onComplete: arrive,
      });
    }
  });
}

// After "Pedir uma demonstração": the form glows and the first field is ready
function inviteToForm() {
  const card = $("[data-form-card]");
  const first = $<HTMLInputElement>("[data-contact-form] input[name='nome']");
  if (!card) return;
  card.classList.remove("invite");
  void card.offsetWidth;
  card.classList.add("invite");
  if (finePointer) first?.focus({ preventScroll: true });
}

/* ---------- Hero: the words rise, the card tilts in ---------- */
function heroIntro(afterLogo = false) {
  const title = $("[data-hero-title]");
  const ins = $$("[data-hero-in]");
  const demo = $("[data-hero-demo]");

  // Never wait on fonts for more than a moment: a slow/blocked font must not hold the hero back
  const fontsOrTimeout = Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))]);

  fontsOrTimeout.then(() => {
    const tl = gsap.timeline({ defaults: { ease: EASE }, onComplete: () => root.classList.add("ready") });

    // After the logo intro the flying mark already landed with its sun
    if (afterLogo) gsap.set(".site-header .mark-sun", { autoAlpha: 1 });
    else tl.from(".site-header .mark-sun", { y: 14, autoAlpha: 0, duration: 1.2, transformOrigin: "50% 50%" }, 0);
    tl.from(".site-header .brand-word, .site-header .nav > *", { y: -12, autoAlpha: 0, duration: .8, stagger: .05 }, .1);

    if (title) {
      // The title's tween stands alone (not inside tl): when the window resizes,
      // SplitText re-splits and reverts only this tween, never the whole hero.
      let titleDone = false;
      SplitText.create(title, {
        type: "lines,words",
        mask: "lines",
        linesClass: "ln",
        autoSplit: true,
        onSplit(self) {
          gsap.set(title, { autoAlpha: 1 });
          if (titleDone) return;
          return gsap.from(self.words, {
            yPercent: 110, rotate: 4, duration: 1.3, stagger: .06, ease: EASE, delay: .15,
            onComplete: () => { titleDone = true; },
          });
        },
      });
      // Safety net: whatever happens, the headline is readable within 3s
      setTimeout(() => {
        if (titleDone) return;
        gsap.set(title, { autoAlpha: 1 });
        gsap.to(title.querySelectorAll(".ln > *"), { yPercent: 0, rotate: 0, duration: .4, overwrite: true });
      }, 3000);
    }
    tl.fromTo(ins, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: .12 }, .6);
    if (demo) {
      tl.fromTo(demo,
        { y: 60, autoAlpha: 0, rotateX: 14, scale: .94, transformPerspective: 1400, transformOrigin: "50% 100%" },
        { y: 0, autoAlpha: 1, rotateX: 0, scale: 1, duration: 1.6 }, .45);
    }
  });
}

// On the way out: copy lifts away faster than the card, the card sinks back (depth)
function heroOut() {
  const hero = $("[data-hero]");
  if (!hero) return;
  gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
    .to(".hero-copy", { yPercent: -22, autoAlpha: .15, ease: "none" }, 0)
    .to("[data-hero-demo]", { yPercent: -8, scale: .94, ease: "none" }, 0)
    .to("[data-scroll-cue]", { autoAlpha: 0, ease: "none", duration: .15 }, 0);
}

/* ---------- Reveals: JS only flips a class; the motion itself is CSS ---------- */
function reveals() {
  $$("[data-reveal], [data-stagger], [data-step]").forEach(el => onView(el, () => el.classList.add("is-in")));

  // Headings are split into lines only when they're about to be seen
  $$("[data-split]").forEach(el => onView(el, () => {
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "ln",
      autoSplit: true,
      onSplit: self => {
        el.classList.add("split-ready");
        if (gentle) return;
        return gsap.from(self.lines, { yPercent: 110, rotate: 2.5, transformOrigin: "0% 100%", duration: 1.3, stagger: .1, ease: EASE });
      },
    });
  }, "0px 0px -8% 0px"));

  // Stats: card rises and its rule draws (CSS), the number counts up
  $$("[data-stat]").forEach((stat, i) => {
    const num = $("[data-count]", stat)!;
    const target = Number(num.dataset.count);
    if (!gentle) num.textContent = "0%";
    onView(stat, () => {
      stat.classList.add("is-in");
      if (gentle) return;
      const counter = { v: 0 };
      gsap.to(counter, {
        v: target, duration: 1.8, delay: .2 + i * .12, ease: "power3.out",
        onUpdate: () => { num.textContent = `${Math.round(counter.v)}%`; },
      });
    });
  });
}

/* ---------- Light sections open like a screen (desktop) ---------- */
function expandSections() {
  if (lite) return;
  $$("[data-expand]").forEach(section => {
    gsap.fromTo(section,
      { clipPath: "inset(0% 5% 0% 5% round 32px)" },
      { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "top 20%", scrub: .5 } });
  });
}

/* ---------- Contact: the gold glow swells as you arrive ---------- */
function contactGlow() {
  const glow = $("[data-contact-glow]");
  if (!glow) return;
  gsap.fromTo(glow, { scale: .5, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, ease: "none",
    scrollTrigger: { trigger: "[data-contact]", start: "top bottom", end: "top 20%", scrub: .6 },
  });
}

/* ---------- Footer: the wordmark rises letter by letter as the page ends ---------- */
function footerWord() {
  const word = $("[data-footer-word]");
  if (!word) return;
  const split = SplitText.create(word, { type: "chars" });
  gsap.from(split.chars, {
    yPercent: 100, ease: "none", stagger: .06,
    scrollTrigger: { trigger: word, start: "top bottom", end: "bottom bottom", scrub: .6 },
  });
}

/* ---------- "Como funciona": pinned story on desktop, step-by-step elsewhere ---------- */
function stepTimeline(step: HTMLElement) {
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  const files = $$(".file", step);
  if (files.length) tl.from(files, { x: -24, autoAlpha: 0, duration: .9, stagger: .14 });
  const chips = $$(".chips [data-piece]", step);
  if (chips.length) {
    tl.from(chips, { y: 14, scale: .9, autoAlpha: 0, duration: .7, stagger: .1 })
      .from($(".tree", step), { scaleY: 0, duration: .6 }, "-=.3")
      .from($$(".tree [data-piece]", step), { x: -12, autoAlpha: 0, duration: .7, stagger: .1 }, "<.1");
  }
  const q = $(".mini-q", step);
  if (q) {
    tl.from(q, { y: 16, autoAlpha: 0, duration: .7 })
      .fromTo($("[data-typing]", step), { autoAlpha: 0, scale: .8 }, { autoAlpha: 1, scale: 1, duration: .3 }, "+=.15")
      .to($("[data-typing]", step), { autoAlpha: 0, scale: .8, duration: .25 }, "+=.9")
      .from($(".mini-a", step), { y: 14, autoAlpha: 0, duration: .8 }, "-=.05");
  }
  return tl;
}

function howItWorks() {
  const section = $("[data-how]");
  if (!section) return;
  const steps = $$("[data-step]", section);
  const bar = $("[data-how-bar]", section);

  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px) and (min-height: 720px)", () => {
    // Pin the section; scrolling plays the three steps in order
    steps.forEach(s => s.classList.add("is-in"));
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: section, start: "top top", end: "+=180%", pin: true, scrub: .8, anticipatePin: 1 },
    });
    tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 3 }, 0);
    steps.forEach((step, i) => {
      tl.fromTo(step, { autoAlpha: .28 }, { autoAlpha: 1, duration: .25 }, i)
        .fromTo($(".step-visual", step), { y: 30 }, { y: 0, duration: .5, ease: "power2.out" }, i)
        .add(stepTimeline(step).duration(.9), i + .05);
    });
  });
  mm.add("(max-width: 1023px), (max-height: 719px)", () => {
    gsap.set(bar, { scaleX: 1 });
    steps.forEach(step => {
      const tl = stepTimeline(step).pause();
      onView(step, () => { step.classList.add("is-in"); tl.play(); });
    });
  });
}

/* ---------- Case: the browser tilts into place, the phone floats past it ---------- */
function caseShowcase() {
  const showcase = $("[data-showcase]");
  if (!showcase) return;
  gsap.fromTo("[data-browser]",
    { rotateX: 22, scale: .86, y: 80, autoAlpha: .2, transformPerspective: 1600, transformOrigin: "50% 0%" },
    { rotateX: 0, scale: 1, y: 0, autoAlpha: 1, ease: "none",
      scrollTrigger: { trigger: showcase, start: "top 95%", end: "top 30%", scrub: .6 } });
  const small = matchMedia("(max-width: 767px)").matches;
  gsap.fromTo("[data-phone]",
    { y: small ? 50 : 160, rotate: 6 },
    { y: small ? -10 : -30, rotate: 0, ease: "none",
      scrollTrigger: { trigger: showcase, start: "top bottom", end: "bottom top", scrub: .8 } });
}

/* ---------- "Funciona com" marquee: drifts, and speeds up with your scroll ---------- */
function marquee() {
  const track = $("[data-marquee-track]");
  if (!track) return;
  track.append(...[...track.children].map(n => {
    const c = n.cloneNode(true) as HTMLElement;
    c.setAttribute("aria-hidden", "true");
    return c;
  }));
  track.parentElement!.classList.add("is-looping");
  const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });

  let settle: gsap.core.Tween | null = null;
  ScrollTrigger.create({
    trigger: "[data-hero]",
    start: "top top",
    end: "bottom top",
    onUpdate: self => {
      const boost = Math.min(Math.abs(self.getVelocity()) / 300, 6);
      loop.timeScale(1 + boost);
      settle?.kill();
      settle = gsap.to(loop, { timeScale: 1, duration: 1.2, ease: "power2.out" });
    },
  });
  // No need to run while nobody can see it
  ScrollTrigger.create({
    trigger: "[data-marquee]",
    start: "top bottom",
    end: "bottom top",
    onToggle: self => { if (self.isActive) loop.play(); else loop.pause(); },
  });
}

/* ---------- Magnetic buttons (mouse only) ---------- */
function magnetic() {
  $$("[data-magnetic]").forEach(el => {
    const x = gsap.quickTo(el, "x", { duration: .5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: .5, ease: "power3.out" });
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * .25);
      y((e.clientY - r.top - r.height / 2) * .35);
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, .35)" });
    });
  });
}

/* ---------- Cursor ring: trails the pointer, opens over anything clickable ---------- */
function cursor() {
  const ring = $("[data-cursor]");
  if (!ring || lite) return;
  const x = gsap.quickTo(ring, "x", { duration: .45, ease: "power3.out" });
  const y = gsap.quickTo(ring, "y", { duration: .45, ease: "power3.out" });
  let shown = false;
  addEventListener("pointermove", e => {
    if (!shown) { shown = true; gsap.set(ring, { x: e.clientX, y: e.clientY }); ring.classList.add("on"); }
    x(e.clientX);
    y(e.clientY);
    const t = e.target as Element;
    ring.classList.toggle("is-link", !!t.closest("a, button, [role='tab']"));
    ring.classList.toggle("is-text", !!t.closest("input, textarea"));
  }, { passive: true });
  document.addEventListener("pointerleave", () => ring.classList.remove("on"));
  document.addEventListener("pointerenter", () => { if (shown) ring.classList.add("on"); });
  addEventListener("pointerdown", () => ring.classList.add("is-down"));
  addEventListener("pointerup", () => ring.classList.remove("is-down"));
}
