import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrollToPlugin);

/* ---------- Motion budget ----------
   full   : capable desktop with a mouse — everything
   lite   : touch devices or weak hardware — no cursor, no clip-path scenes
   gentle : prefers-reduced-motion — opacity fades only, no movement */
const root = document.documentElement;
const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
const gentle = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const lowEnd = (nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4 || !!nav.connection?.saveData;
const lite = !finePointer || lowEnd;
root.classList.toggle("lite", lite);

const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => el.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => [...el.querySelectorAll<T>(sel)];

const EASE = "expo.out";
const ONCE = (trigger: Element, start = "top 85%") => ({ trigger, start, once: true });
const HEADER_OFFSET = -72;

let lenis: Lenis | null = null;

headerState();
activeNav();
anchors();

if (gentle) {
  gentleMode();
} else {
  lenis = new Lenis({ autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  heroIntro();
  scrollScenes();
  marquee();
  if (finePointer) { magnetic(); cursor(); }
  heroLight();
}

/* ---------- Reduced motion: content fades in, nothing moves ---------- */
function gentleMode() {
  root.classList.add("ready");
  $$("[data-stat]").forEach(s => s.classList.add("is-in"));
  $$("[data-reveal], [data-split], [data-stagger], [data-stat], [data-step], [data-showcase]").forEach(el => {
    gsap.from(el, { autoAlpha: 0, duration: .8, ease: "power1.out", scrollTrigger: ONCE(el, "top 92%") });
  });
}

/* ---------- Header: gains depth, hides on the way down ---------- */
function headerState() {
  const header = $("[data-header]");
  if (!header) return;
  let lastY = scrollY;
  const update = () => {
    const y = scrollY;
    header.classList.toggle("scrolled", y > 8);
    // Only change on real movement: Lenis can fire repeat events at the same y
    if (Math.abs(y - lastY) < 3) return;
    header.classList.toggle("hide", !gentle && y > 400 && y > lastY);
    lastY = y;
  };
  addEventListener("scroll", update, { passive: true });
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

    if (lenis) {
      const dist = Math.abs(target.getBoundingClientRect().top);
      lenis.scrollTo(target, {
        // sections carry scroll-margin-top for the header, which Lenis already honours
        offset: 0,
        duration: Math.min(2.2, Math.max(1, dist / 2200)),
        easing: expoInOut,
        onComplete: arrive,
      });
    } else {
      // Reduced motion: still a glide, just shorter and calmer
      gsap.to(window, {
        scrollTo: { y: target === document.body ? 0 : target, offsetY: -HEADER_OFFSET },
        duration: .8,
        ease: "power2.inOut",
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

/* ---------- Hero: the light rises, then the words ---------- */
function heroIntro() {
  const title = $("[data-hero-title]");
  const ins = $$("[data-hero-in]");
  const demo = $("[data-hero-demo]");

  document.fonts.ready.then(() => {
    const tl = gsap.timeline({ defaults: { ease: EASE }, onComplete: () => root.classList.add("ready") });

    tl.from(".site-header .mark-sun", { y: 14, autoAlpha: 0, duration: 1.2, transformOrigin: "50% 50%" }, 0)
      .from(".site-header .brand-word, .site-header .nav > *", { y: -12, autoAlpha: 0, duration: .8, stagger: .05 }, .1);

    if (title) {
      SplitText.create(title, {
        type: "lines,words",
        mask: "lines",
        linesClass: "ln",
        autoSplit: true,
        onSplit(self) {
          gsap.set(title, { autoAlpha: 1 });
          return tl.from(self.words, { yPercent: 110, rotate: 4, duration: 1.3, stagger: .06 }, .15);
        },
      });
    }
    tl.fromTo(ins, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: .12 }, .6);
    if (demo) {
      tl.fromTo(demo,
        { y: 60, autoAlpha: 0, rotateX: 14, scale: .94, transformPerspective: 1400, transformOrigin: "50% 100%" },
        { y: 0, autoAlpha: 1, rotateX: 0, scale: 1, duration: 1.6 }, .45);
    }
  });

  // On the way out: copy lifts away faster than the card, the card sinks back (depth)
  const hero = $("[data-hero]");
  if (hero) {
    gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
      .to(".hero-copy", { yPercent: -22, autoAlpha: .15, ease: "none" }, 0)
      .to("[data-hero-demo]", { yPercent: -8, scale: .94, ease: "none" }, 0)
      .to("[data-scroll-cue]", { autoAlpha: 0, ease: "none", duration: .15 }, 0);
  }
}

/* ---------- Scroll scenes ---------- */
function scrollScenes() {
  // Headings: lines rise out of a mask, with a slight tilt that settles
  $$("[data-split]").forEach(el => {
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "ln",
      autoSplit: true,
      onSplit: self => gsap.from(self.lines, {
        yPercent: 110, rotate: 2.5, transformOrigin: "0% 100%",
        duration: 1.3, stagger: .1, ease: EASE, scrollTrigger: ONCE(el),
      }),
    });
  });

  $$("[data-reveal]").forEach(el => {
    gsap.from(el, { y: 36, autoAlpha: 0, duration: 1.2, ease: EASE, scrollTrigger: ONCE(el, "top 90%") });
  });

  $$("[data-stagger]").forEach(el => {
    gsap.from(el.children, { y: 32, autoAlpha: 0, duration: 1.1, stagger: .09, ease: EASE, scrollTrigger: ONCE(el, "top 88%") });
  });

  // Stats: rule draws (CSS, via .is-in) and the number counts up
  $$("[data-stat]").forEach((stat, i) => {
    const num = $("[data-count]", stat)!;
    const target = Number(num.dataset.count);
    const counter = { v: 0 };
    num.textContent = "0%";
    gsap.from(stat, { y: 40, autoAlpha: 0, duration: 1.2, delay: i * .12, ease: EASE, scrollTrigger: ONCE(stat) });
    gsap.to(counter, {
      v: target, duration: 1.8, delay: .2 + i * .12, ease: "power3.out",
      onUpdate: () => { num.textContent = `${Math.round(counter.v)}%`; },
      scrollTrigger: { ...ONCE(stat), onEnter: () => stat.classList.add("is-in") },
    });
  });

  // Light sections open like a screen: a rounded card that expands to full bleed
  if (!lite) {
    $$("[data-expand]").forEach(section => {
      gsap.fromTo(section,
        { clipPath: "inset(0% 5% 0% 5% round 32px)" },
        { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "top 20%", scrub: .5 } });
    });
  }

  // Contact: the gold glow swells as you arrive
  const glow = $("[data-contact-glow]");
  if (glow) {
    gsap.fromTo(glow, { scale: .5, autoAlpha: 0 }, {
      scale: 1, autoAlpha: 1, ease: "none",
      scrollTrigger: { trigger: "[data-contact]", start: "top bottom", end: "top 20%", scrub: .6 },
    });
  }

  // Footer: the wordmark rises letter by letter as the page ends
  const word = $("[data-footer-word]");
  if (word) {
    const split = SplitText.create(word, { type: "chars" });
    gsap.from(split.chars, {
      yPercent: 100, ease: "none", stagger: .06,
      scrollTrigger: { trigger: word, start: "top bottom", end: "bottom bottom", scrub: .6 },
    });
  }

  howItWorks();
  caseShowcase();
}

/* ---------- "Como funciona": pinned story on desktop, step-by-step on mobile ---------- */
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
      gsap.from(step, { y: 40, autoAlpha: 0, duration: 1.1, ease: EASE, scrollTrigger: ONCE(step) });
      const tl = stepTimeline(step).pause();
      ScrollTrigger.create({ ...ONCE(step, "top 75%"), onEnter: () => { tl.play(); } });
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

/* ---------- WebGL hero light: capable desktops only, loaded when idle ---------- */
function heroLight() {
  const canvas = $<HTMLCanvasElement>("[data-hero-gl]");
  const hero = $("[data-hero]");
  if (!canvas || !hero || lite || !matchMedia("(min-width: 900px)").matches) return;

  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  idle(() => {
    import("./gl").then(({ mountHeroGL }) => {
      const gl = mountHeroGL(canvas, hero);
      if (!gl) return;
      ScrollTrigger.create({
        trigger: hero, start: "top top", end: "bottom top",
        onUpdate: self => gl.setScroll(self.progress),
      });
    });
  });
}
