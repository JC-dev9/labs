const SOURCES = [
  { label: "Bíblia", ref: "Génesis 1:1",
    excerpt: "“No princípio, criou Deus os céus e a terra.”",
    q: "O que quer dizer “no princípio”?",
    a: "Marca o início de tudo o que existe. O texto abre a narrativa a apresentar Deus como origem da criação." },
  { label: "Os Lusíadas", ref: "Canto I, estância 1",
    excerpt: "“As armas e os barões assinalados, / Que da ocidental praia Lusitana, / Por mares nunca de antes navegados…”",
    q: "Quem são “os barões assinalados”?",
    a: "São os navegadores portugueses. Camões anuncia que vai cantar os heróis que partiram por mares que ninguém tinha navegado." },
  { label: "Manual interno", ref: "Procedimentos · 4.2",
    excerpt: "Os pedidos de férias são submetidos no portal interno, com antecedência mínima, e aprovados pela chefia direta.",
    q: "Como peço férias?",
    a: "Faça o pedido no portal interno, com a antecedência indicada no manual. A sua chefia direta recebe e aprova." }
];

// Hero demo: rotates every 4.5s until the visitor picks a tab.
const demo = document.getElementById("demo");
const tablist = demo.querySelector(".tabs");
let active = 0;
let paused = false;

const tabs = SOURCES.map((s, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("role", "tab");
  b.textContent = s.label;
  b.addEventListener("click", () => { paused = true; show(i); });
  tablist.appendChild(b);
  return b;
});

function show(i) {
  active = i;
  const s = SOURCES[i];
  tabs.forEach((t, j) => t.setAttribute("aria-selected", String(j === i)));
  demo.querySelectorAll("[data-ref]").forEach(el => { el.textContent = s.ref; });
  demo.querySelector("[data-excerpt]").textContent = s.excerpt;
  demo.querySelector("[data-q]").textContent = s.q;
  demo.querySelector("[data-a]").textContent = s.a;
}

show(0);
setInterval(() => { if (!paused) show((active + 1) % SOURCES.length); }, 4500);

// Contact form: kind toggle + local "sent" state (no backend yet).
const form = document.getElementById("contact-form");
const kindInput = form.elements.tipo;
const kindButtons = form.querySelectorAll("[data-kind]");
kindButtons.forEach(b => b.addEventListener("click", () => {
  kindButtons.forEach(o => o.setAttribute("aria-pressed", String(o === b)));
  kindInput.value = b.dataset.kind;
}));

form.addEventListener("submit", e => {
  e.preventDefault();
  form.hidden = true;
  document.getElementById("thanks").hidden = false;
});
