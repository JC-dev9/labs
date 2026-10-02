// Hero light: a single full-screen fragment shader, no libraries.
// Rendered at reduced resolution (it's all soft light, so upscaling is
// invisible) and paused whenever the hero is off-screen or the tab is hidden.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;   // -1..1, eased
uniform float uIntro;  // 0 -> 1 as the light rises on load
uniform float uScroll; // 0 -> 1 as the hero scrolls away

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float aspect = uRes.x / uRes.y;

  // Light source: upper right, rises on intro, sinks as you scroll, leans to the cursor
  vec2 lp = vec2(0.30 * aspect, 0.22);
  lp.y -= (1.0 - uIntro) * 0.75 + uScroll * 0.45;
  lp += uMouse * vec2(0.06, 0.04);

  vec2 d = p - lp;
  float r = length(d);
  float t = uTime;

  // Soft core + wide bloom
  float glow = 0.85 * exp(-r * r * 22.0) + 0.42 * exp(-r * 2.8);

  // Volumetric rays: noise sampled by angle, slowly turning
  float ang = atan(d.y, d.x);
  float rays = fbm(vec2(ang * 2.6 + t * 0.03, t * 0.06));
  rays = pow(rays, 2.2) * 1.6 * exp(-r * 1.6);

  // Drifting haze, domain-warped so it flows like light through dust
  vec2 q = p * 1.5 + vec2(t * 0.025, -t * 0.018);
  float haze = fbm(q + fbm(q * 1.7 + t * 0.04));
  haze = haze * haze * 0.55 * exp(-r * 1.25);

  float k = (glow + rays + haze) * uIntro * (1.0 - uScroll * 0.85);
  // Keep the headline side dark and readable
  k *= smoothstep(-0.95 * aspect * 0.5, 0.15, p.x);

  vec3 bg = vec3(0.039, 0.043, 0.051);
  vec3 gold = vec3(0.957, 0.788, 0.365);
  vec3 warm = vec3(1.0, 0.95, 0.85);
  vec3 col = bg + gold * k * 0.55 + warm * pow(glow * uIntro, 3.0) * 0.18;

  // Dither to kill gradient banding
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface HeroGL {
  setScroll(p: number): void;
  destroy(): void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

export function mountHeroGL(canvas: HTMLCanvasElement, host: HTMLElement): HeroGL | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });
  if (!gl) return null;

  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(prog, "uRes"),
    time: gl.getUniformLocation(prog, "uTime"),
    mouse: gl.getUniformLocation(prog, "uMouse"),
    intro: gl.getUniformLocation(prog, "uIntro"),
    scroll: gl.getUniformLocation(prog, "uScroll"),
  };

  const SCALE = 0.5; // render at half resolution; soft light hides it
  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl!.viewport(0, 0, w, h);
    }
    gl!.uniform2f(u.res, w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Eased inputs
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0;
  const onMove = (e: PointerEvent) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / innerHeight) * 2 - 1);
  };
  addEventListener("pointermove", onMove, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); });
  io.observe(host);
  const onVis = () => { if (!document.hidden) loop(); };
  document.addEventListener("visibilitychange", onVis);

  const start = performance.now();
  let raf = 0;
  let first = true;
  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = (now - start) / 1000;
    const intro = Math.min(1, t / 2.2);
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    gl!.uniform1f(u.time, t);
    gl!.uniform1f(u.intro, 1 - Math.pow(1 - intro, 3));
    gl!.uniform1f(u.scroll, scroll);
    gl!.uniform2f(u.mouse, mouse.x, mouse.y);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    if (first) { first = false; canvas.classList.add("is-on"); host.classList.add("has-gl"); }
    loop();
  }
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }
  loop();

  return {
    setScroll(p) { scroll = p; },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      gl!.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
