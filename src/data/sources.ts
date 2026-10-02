export interface Source {
  label: string;
  ref: string;
  excerpt: string;
  q: string;
  a: string;
}

export const SOURCES: Source[] = [
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
    a: "Faça o pedido no portal interno, com a antecedência indicada no manual. A sua chefia direta recebe e aprova." },
];
