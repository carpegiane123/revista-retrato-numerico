(function () {
  "use strict";

  /* ======================================================================
     0. AJUDANTES
     ====================================================================== */

  /** Atalho para achar um elemento pelo id. */
  const $ = (id) => document.getElementById(id);

  /** Atalho para achar vários elementos por seletor CSS. */
  const $$ = (seletor, raiz) => Array.from((raiz || document).querySelectorAll(seletor));

  const SVG_NS = "http://www.w3.org/2000/svg";

  /** Cria um elemento SVG com atributos (ex.: criarSvg("rect", {x: 10, width: 50})). */
  function criarSvg(nome, atributos, texto) {
    const el = document.createElementNS(SVG_NS, nome);
    Object.keys(atributos || {}).forEach((k) => el.setAttribute(k, atributos[k]));
    if (texto != null) el.textContent = texto;
    return el;
  }

  /** O leitor pediu menos animação no sistema? */
  const prefereMenosMovimento = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Número no padrão brasileiro: 1234.5 → "1.234,5". */
  function numero(valor, casas) {
    return Number(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: casas || 0,
      maximumFractionDigits: casas || 0,
    });
  }

  /** Dinheiro: 93000 → "R$ 93.000". */
  function reais(valor) {
    return "R$ " + numero(Math.round(valor), 0);
  }

  /** Dinheiro em forma curta para caber embaixo das barras: 1400 → "1,4 mil"; 1000000 → "1 mi". */
  function reaisCurto(valor) {
    const v = Math.round(valor);
    if (v >= 1e9) return "R$ " + numero(v / 1e9, v % 1e9 === 0 ? 0 : 1) + " bi";
    if (v >= 1e6) return "R$ " + numero(v / 1e6, v % 1e6 === 0 ? 0 : 1) + " mi";
    if (v >= 1e4) return "R$ " + numero(v / 1e3, 0) + " mil";
    if (v >= 1e3) return "R$ " + numero(v / 1e3, 1) + " mil";
    return "R$ " + v;
  }

  /** Mantém um número dentro de um intervalo. */
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  /** Mediana de uma lista de números (o valor do meio da fila ordenada). */
  function mediana(lista) {
    const o = lista.slice().sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  }

  /** Média comum. */
  const media = (lista) => lista.reduce((s, x) => s + x, 0) / lista.length;

  /**
   * Anima uma lista de números de "de" até "para".
   * A cada quadro chama aoMudar(listaAtual). Devolve uma função que cancela a animação.
   */
  function animar(de, para, duracao, aoMudar, aoTerminar) {
    if (prefereMenosMovimento() || duracao <= 0) {
      aoMudar(para.slice());
      if (aoTerminar) aoTerminar();
      return function () {};
    }
    const inicio = performance.now();
    let id = 0;
    function passo(agora) {
      const t = limitar((agora - inicio) / duracao, 0, 1);
      const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // começa e termina devagar
      aoMudar(de.map((v, i) => v + (para[i] - v) * suave));
      if (t < 1) id = requestAnimationFrame(passo);
      else if (aoTerminar) aoTerminar();
    }
    id = requestAnimationFrame(passo);
    return function () { cancelAnimationFrame(id); };
  }

  /** Lê/escreve no armazenamento do navegador sem quebrar se ele estiver bloqueado. */
  const guardar = {
    ler(chave) { try { return window.localStorage.getItem(chave); } catch (e) { return null; } },
    gravar(chave, valor) { try { window.localStorage.setItem(chave, valor); } catch (e) { /* tudo bem */ } },
  };


  /* ======================================================================
     1. FERRAMENTAS DE LEITURA
     ====================================================================== */
  const raiz = document.documentElement;

  /* ---- Tema claro/escuro ---- */
  function temaAtual() {
    const marcado = raiz.getAttribute("data-tema");
    if (marcado === "claro" || marcado === "escuro") return marcado;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  }

  function aplicarTema(tema, salvar) {
    raiz.setAttribute("data-tema", tema);
    const cor = document.querySelector('meta[name="theme-color"]');
    if (cor) cor.setAttribute("content", tema === "escuro" ? "#1b1916" : "#f6f0e4");
    const botao = $("btn-tema");
    if (botao) botao.setAttribute("aria-pressed", String(tema === "escuro"));
    if (salvar) guardar.gravar("conta-de-gente-tema", tema);
  }

  function iniciarTema() {
    const salvo = guardar.ler("conta-de-gente-tema");
    aplicarTema(salvo === "claro" || salvo === "escuro" ? salvo : temaAtual(), false);
    const botao = $("btn-tema");
    if (botao) botao.addEventListener("click", () => aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro", true));
  }

/* ---- Tamanho da letra ---- */
  const ESCALAS = [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
  let escala = 1;

  function escalaMaisProxima(valor) {
    return ESCALAS.reduce((melhor, atual) =>
      Math.abs(atual - valor) < Math.abs(melhor - valor) ? atual : melhor
    );
  }

  function aplicarEscala(nova, salvar) {
    escala = escalaMaisProxima(nova);
    raiz.style.setProperty("--escala-fonte", String(escala));

    const idx = ESCALAS.indexOf(escala);
    const menos = $("btn-fonte-menos");
    const mais = $("btn-fonte-mais");
    const valor = $("btn-fonte-valor");

    if (menos) menos.disabled = idx <= 0;
    if (mais) mais.disabled = idx >= ESCALAS.length - 1;

    // Mostra a porcentagem atual (100% = tamanho normal) no botão do meio.
    const pct = Math.round(escala * 100);
    if (valor) {
      valor.textContent = pct + "%";
      valor.disabled = pct === 100;
      valor.title = pct === 100 ? "Tamanho normal (100%)" : "Clique para voltar ao tamanho normal (100%)";
      valor.setAttribute(
        "aria-label",
        pct === 100
          ? "Tamanho da letra: 100% (normal)"
          : "Tamanho da letra: " + pct + "%. Clique para voltar a 100%"
      );
    }

    if (salvar) guardar.gravar("conta-de-gente-escala", String(escala));
  }

  function iniciarFonte() {
    const salva = parseFloat(guardar.ler("conta-de-gente-escala"));
    aplicarEscala(isFinite(salva) ? salva : 1, false);

    const menos = $("btn-fonte-menos");
    const mais = $("btn-fonte-mais");
    const valor = $("btn-fonte-valor");

    if (menos) {
      menos.addEventListener("click", () => {
        const idx = ESCALAS.indexOf(escala);
        if (idx > 0) aplicarEscala(ESCALAS[idx - 1], true);
      });
    }
    if (mais) {
      mais.addEventListener("click", () => {
        const idx = ESCALAS.indexOf(escala);
        if (idx < ESCALAS.length - 1) aplicarEscala(ESCALAS[idx + 1], true);
      });
    }
    if (valor) valor.addEventListener("click", () => aplicarEscala(1, true));
  }

  /* ---- Imprimir / salvar em PDF ---- */
  // Antes de imprimir, abrimos todas as respostas (<details>) para saírem no PDF.
  // Depois de imprimir, fechamos de novo só as que estavam fechadas.
  let detalhesFechados = [];

  function abrirDetalhesParaImprimir() {
    detalhesFechados = $$("details").filter((d) => !d.open);
    detalhesFechados.forEach((d) => { d.open = true; });
  }
  function restaurarDetalhes() {
    detalhesFechados.forEach((d) => { d.open = false; });
    detalhesFechados = [];
  }

  function iniciarImpressao() {
    ["btn-imprimir", "btn-imprimir-rodape"].forEach((id) => {
      const b = $(id);
      if (b) b.addEventListener("click", () => window.print());
    });
    window.addEventListener("beforeprint", abrirDetalhesParaImprimir);
    window.addEventListener("afterprint", restaurarDetalhes);
    // Safari antigo não dispara beforeprint/afterprint: esta é a alternativa.
    if (window.matchMedia) {
      const consulta = window.matchMedia("print");
      const aoMudar = (e) => (e.matches ? abrirDetalhesParaImprimir() : restaurarDetalhes());
      if (consulta.addEventListener) consulta.addEventListener("change", aoMudar);
      else if (consulta.addListener) consulta.addListener(aoMudar);
    }
  }

  /* ---- Voltar ao topo ---- */
  function iniciarTopo() {
    const b = $("btn-topo");
    if (!b) return;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefereMenosMovimento() ? "auto" : "smooth" });
      const alvo = $("topo");
      if (alvo) { alvo.setAttribute("tabindex", "-1"); alvo.focus({ preventScroll: true }); }
    });
  }


  /* ======================================================================
     2. BARRA DE PROGRESSO E MENU
     ====================================================================== */
  function iniciarProgresso() {
    const barra = $("barra-progresso");
    let espera = false;

    function atualizar() {
      espera = false;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? limitar((window.scrollY / total) * 100, 0, 100) : 0;
      if (barra) {
        barra.style.setProperty("--progresso", pct.toFixed(2));
        barra.setAttribute("aria-valuenow", String(Math.round(pct)));
      }
    }
    function pedir() {
      if (!espera) { espera = true; requestAnimationFrame(atualizar); }
    }
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    atualizar();
  }

  /** Destaca no menu a seção que o leitor está lendo. */
  function iniciarMenu() {
    const menu = $("menu-secoes");
    if (!menu || !("IntersectionObserver" in window)) return;
    const links = $$("a[href^='#']", menu);
    const mapa = new Map();
    links.forEach((a) => {
      const alvo = document.getElementById(a.getAttribute("href").slice(1));
      if (alvo) mapa.set(alvo, a);
    });

    function marcar(link) {
      links.forEach((a) => {
        const ativo = a === link;
        a.classList.toggle("ativo", ativo);
        if (ativo) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      // deixa o link ativo visível se o menu estiver rolando na horizontal
      const lista = link && link.closest("ul");
      if (lista && lista.scrollWidth > lista.clientWidth) {
        const alvoX = link.offsetLeft - lista.clientWidth / 2 + link.clientWidth / 2;
        lista.scrollTo({ left: alvoX, behavior: prefereMenosMovimento() ? "auto" : "smooth" });
      }
    }

    const visiveis = new Set();
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { if (e.isIntersecting) visiveis.add(e.target); else visiveis.delete(e.target); });
      // fica com a seção visível que aparece mais acima na tela
      let melhor = null, topo = Infinity;
      visiveis.forEach((el) => {
        const t = Math.abs(el.getBoundingClientRect().top);
        if (t < topo) { topo = t; melhor = el; }
      });
      marcar(melhor ? mapa.get(melhor) : null);
    }, { rootMargin: "-20% 0px -60% 0px", threshold: 0 });

    mapa.forEach((_, alvo) => obs.observe(alvo));
  }


  /* ======================================================================
     3. MÃO NA MASSA 1 — PIRÂMIDE ETÁRIA
     ======================================================================
     Os dados ficam em PIRAMIDE. Cada ano tem 17 valores: a porcentagem da população
     (homens + mulheres) em cada faixa de 5 anos: 0–4, 5–9, ..., 75–79 e 80 ou mais.
     Para trocar por números exatos do IBGE: coloquem aqui 17 números por ano
     (a soma deve dar 100) e o desenho e os indicadores se atualizam sozinhos. */
  const FAIXAS = ["0–4", "5–9", "10–14", "15–19", "20–24", "25–29", "30–34", "35–39", "40–44",
                  "45–49", "50–54", "55–59", "60–64", "65–69", "70–74", "75–79", "80+"];

  /**
   * Transforma as faixas publicadas pelo IBGE (0–4, 5–9, 10–14, 15–19, 20–24, 25–29 de 5 em 5
   * e depois 30–39, 40–49, 50–59, 60–69 e 70+) em 17 faixas de 5 anos, dividindo cada faixa
   * de 10 anos em duas partes (parte da faixa mais nova um pouco maior, como é na vida real).
   * A porcentagem é calculada em cima do total das pessoas com idade declarada.
   */
  function dezEmCinco(censo) {
    // censo = [0-4, 5-9, 10-14, 15-19, 20-24, 25-29, 30-39, 40-49, 50-59, 60-69, 70+] (em milhares)
    const [a, b, c, d, e, f, g30, g40, g50, g60, g70] = censo;
    const div = (t, p) => [t * p, t * (1 - p)];
    const faixas = [a, b, c, d, e, f]
      .concat(div(g30, 0.56), div(g40, 0.56), div(g50, 0.56), div(g60, 0.56),
              [g70 * 0.5, g70 * 0.3, g70 * 0.2]);
    const soma = faixas.reduce((s, x) => s + x, 0);
    return faixas.map((x) => (x / soma) * 100);
  }

  const PIRAMIDE = {
    anos: [1950, 1980, 2000, 2022, 2040],

    // Censos (Anuário Estatístico do Brasil 2024, tabela 2.1.1.1) — milhares de pessoas, ambos os sexos.
    1950: dezEmCinco([8370.9, 7015.5, 6308.6, 5502.3, 4991.1, 4132.3, 6286.1, 4365.4, 2650.3, 1451.5, 753.9]),
    1980: dezEmCinco([16423.7, 14773.7, 14263.3, 13576.0, 11513.2, 9442.2, 14039.1, 10377.3, 7250.1, 4474.5, 2741.5]),
    2000: dezEmCinco([16375.7, 16542.3, 17348.1, 17939.8, 16141.5, 13849.7, 25290.5, 19268.2, 12507.3, 8182.0, 6354.0]),

    // 2022: ajustado aos indicadores do Censo (0–14: 19,8% · 15–64: 69,3% · 65+: 10,9% · mediana ≈ 35 anos).
    2022: [5.9, 6.5, 7.4, 6.8, 7.1, 7.5, 8.1, 8.3, 8.2, 7.1, 6.0, 5.3, 4.9, 3.8, 2.8, 1.9, 2.4],

    // 2040 (projeção): ajustado a 60+ = 25,1% · 70+ = 11,5% · 80+ = 4,2% (Projeções IBGE, revisão 2024).
    // A parte de 0 a 14 anos (15,5%) e o formato de cada barra são estimativas didáticas.
    2040: [4.9, 5.2, 5.4, 5.6, 5.8, 6.2, 6.7, 7.1, 7.4, 7.3, 6.9, 6.4, 7.3, 6.3, 4.3, 3.0, 4.2],
  };

  /**
   * Razão de sexo aproximada: homens para cada 100 mulheres em cada faixa.
   * Âncoras reais do Censo 2022: 103,5 em 0–4; mais homens até 24 anos; mais mulheres a partir
   * de 25; 75,9 entre os 65+; cerca de metade entre 90 e 94 anos. O resto é interpolação.
   */
  const RAZAO_SEXO = [103.5, 103.2, 102.8, 102, 100.5, 98, 96, 95, 94, 92.5, 91, 88.5, 86, 82, 77, 70, 58];

  /** Divide cada faixa entre homens e mulheres. Devolve { h: [17], m: [17] } em % do total. */
  function dividirPorSexo(pct) {
    const h = [], m = [];
    pct.forEach((p, i) => {
      const r = RAZAO_SEXO[i];
      h.push((p * r) / (100 + r));
      m.push((p * 100) / (100 + r));
    });
    return { h, m };
  }

  /** Calcula os indicadores de um ano: % de 0–14, % de 65+ e idade mediana. */
  function indicadoresPiramide(pct) {
    const jovens = pct[0] + pct[1] + pct[2];
    const idosos = pct[13] + pct[14] + pct[15] + pct[16];
    // mediana: onde a soma acumulada passa de 50%, dentro da faixa de 5 anos (interpolação)
    let acum = 0, med = 80;
    for (let i = 0; i < pct.length; i++) {
      if (acum + pct[i] >= 50) { med = i * 5 + ((50 - acum) / pct[i]) * 5; break; }
      acum += pct[i];
    }
    return { jovens, idosos, mediana: med };
  }

  const TEXTOS_PIRAMIDE = {
    1950: "Em 1950 o desenho parece uma pirâmide de verdade: base larguíssima (muitas crianças) e topo fininho (poucos idosos). Quase metade do país era criança e adolescente.",
    1980: "Em 1980 a base ainda é larga, mas as barras de baixo já deixam de crescer tanto: as famílias começavam a ter menos filhos. A “pirâmide” ainda está de pé.",
    2000: "Em 2000 a base encolheu e o meio engordou. Quem nasceu nos anos de muitos bebês virou jovem e adulto, e o desenho começa a parecer uma torre.",
    2022: "Em 2022, o Censo mostra o “barril”: as barras do meio são as maiores e a base ficou mais estreita. Pela primeira vez, as crianças de 0 a 14 anos são menos de 20% da população.",
    2040: "Em 2040 (uma projeção, não uma contagem), o topo engorda de verdade: os idosos aparecem em quantidade e a base fica ainda mais estreita. É o Brasil que está chegando.",
  };

  function iniciarPiramide() {
    const svg = $("pir-svg"), slider = $("pir-ano");
    if (!svg || !slider) return;

    // ---- medidas do desenho (o SVG tem viewBox 640 × 420) ----
    const centro = 320, vao = 26;                 // metade do espaço central onde ficam os números das idades
    const topoY = 38, passoY = 20.5, altBarra = 17;
    const escalaX = 31;                           // pixels por 1% da população
    const xHomem = centro - vao, xMulher = centro + vao;

    // limpa e desenha o que não muda
    $$(".pir-fixo", svg).forEach((n) => n.remove());
    const fixo = criarSvg("g", { class: "pir-fixo", "aria-hidden": "true" });
    svg.appendChild(fixo);

    // linhas de grade e números de porcentagem (2%, 4%, 6%, 8%)
    [2, 4, 6, 8].forEach((p) => {
      const dx = p * escalaX;
      const yBase = topoY + FAIXAS.length * passoY;
      [xHomem - dx, xMulher + dx].forEach((x) => {
        fixo.appendChild(criarSvg("line", { class: "pir-eixo", x1: x, x2: x, y1: topoY - 4, y2: yBase, "stroke-dasharray": "2 4" }));
        fixo.appendChild(criarSvg("text", { class: "pir-rotulo", x: x, y: yBase + 16, "text-anchor": "middle" }, p + "%"));
      });
    });
    fixo.appendChild(criarSvg("text", { class: "pir-lado pir-lado--homem", x: xHomem, y: 20, "text-anchor": "end" }, "Homens"));
    fixo.appendChild(criarSvg("text", { class: "pir-lado pir-lado--mulher", x: xMulher, y: 20, "text-anchor": "start" }, "Mulheres"));

    // barras e números das idades (de baixo para cima: 0–4 fica embaixo)
    const barrasH = [], barrasM = [];
    const grupo = criarSvg("g", { class: "pir-barras" });
    svg.appendChild(grupo);
    FAIXAS.forEach((faixa, i) => {
      const y = topoY + (FAIXAS.length - 1 - i) * passoY;
      const h = criarSvg("rect", { class: "pir-barra--homem", x: xHomem, y: y, width: 0, height: altBarra, rx: 2 });
      const m = criarSvg("rect", { class: "pir-barra--mulher", x: xMulher, y: y, width: 0, height: altBarra, rx: 2 });
      h.appendChild(criarSvg("title", {}, ""));
      m.appendChild(criarSvg("title", {}, ""));
      grupo.appendChild(h); grupo.appendChild(m);
      barrasH.push(h); barrasM.push(m);
      fixo.appendChild(criarSvg("text", { class: "pir-rotulo", x: centro, y: y + altBarra - 4, "text-anchor": "middle" }, faixa));
    });

    // ---- estado ----
    let indiceAtual = parseInt(slider.value, 10);
    let valoresAtuais = null;   // 34 números: 17 homens + 17 mulheres (em %)
    let cancelar = function () {};
    let timer = null;

    function valoresDoAno(indice) {
      const ano = PIRAMIDE.anos[indice];
      const { h, m } = dividirPorSexo(PIRAMIDE[ano]);
      return h.concat(m);
    }

    function desenhar(valores, indice) {
      for (let i = 0; i < FAIXAS.length; i++) {
        const w = valores[i] * escalaX, wm = valores[FAIXAS.length + i] * escalaX;
        barrasH[i].setAttribute("width", w.toFixed(2));
        barrasH[i].setAttribute("x", (xHomem - w).toFixed(2));
        barrasM[i].setAttribute("width", wm.toFixed(2));
      }
      // textos de acessibilidade: só no fim da animação, para não pesar
      if (indice != null) {
        const ano = PIRAMIDE.anos[indice];
        const alvo = valoresDoAno(indice);
        for (let i = 0; i < FAIXAS.length; i++) {
          barrasH[i].firstChild.textContent = "Homens, " + FAIXAS[i] + " anos: " + numero(alvo[i], 1) + "% da população";
          barrasM[i].firstChild.textContent = "Mulheres, " + FAIXAS[i] + " anos: " + numero(alvo[FAIXAS.length + i], 1) + "% da população";
        }
        svg.setAttribute("aria-label", "Pirâmide etária do Brasil em " + ano);
      }
    }

    function atualizarTextos(indice) {
      const ano = PIRAMIDE.anos[indice];
      const ind = indicadoresPiramide(PIRAMIDE[ano]);
      const rotulo = ano === 2040 ? "2040 (projeção)" : String(ano);
      const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
      set("pir-ano-texto", rotulo);
      set("pir-formato", TEXTOS_PIRAMIDE[ano]);
      set("pir-jovens", numero(ind.jovens, 1) + "%");
      set("pir-idosos", numero(ind.idosos, 1) + "%");
      set("pir-mediana", "cerca de " + Math.round(ind.mediana) + " anos");
      slider.setAttribute("aria-valuetext", rotulo);
    }

    function irPara(indice, duracao) {
      cancelar();
      indiceAtual = indice;
      slider.value = String(indice);
      atualizarTextos(indice);
      const alvo = valoresDoAno(indice);
      if (!valoresAtuais) valoresAtuais = alvo.map(() => 0);   // primeira vez: as barras "crescem" do zero
      cancelar = animar(valoresAtuais, alvo, duracao, (v) => { valoresAtuais = v; desenhar(v, null); }, () => {
        valoresAtuais = alvo; desenhar(alvo, indice);
      });
    }

    
    // ---- animação "Tocar" ----
    const botaoPlay = $("pir-play");
    function parar() {
      if (timer) { clearInterval(timer); timer = null; }
      if (botaoPlay) {
        botaoPlay.textContent = "Tocar animação";
        botaoPlay.classList.remove("tocando");
        botaoPlay.setAttribute("aria-pressed", "false");
      }
    }
    function tocar() {
      if (!botaoPlay) return;
      botaoPlay.textContent = "Pausar";
      botaoPlay.classList.add("tocando");
      botaoPlay.setAttribute("aria-pressed", "true");
      if (indiceAtual >= PIRAMIDE.anos.length - 1) irPara(0, 500);
      timer = setInterval(() => {
        if (indiceAtual >= PIRAMIDE.anos.length - 1) { parar(); return; }
        irPara(indiceAtual + 1, 1200);
      }, 2200);
    }

    slider.addEventListener("input", () => { parar(); irPara(parseInt(slider.value, 10), 450); });
    if (botaoPlay) {
      botaoPlay.setAttribute("aria-pressed", "false");
      botaoPlay.addEventListener("click", () => (timer ? parar() : tocar()));
    }

    irPara(indiceAtual, 700);
  }

/* ======================================================================
     EXTRA — ONDE VOCÊ ESTÁ NA PIRÂMIDE?
     Usa os mesmos dados da pirâmide (PIRAMIDE[2022] e PIRAMIDE[1980]).
     ====================================================================== */
  function iniciarPosicao() {
    const campo = $("pos-idade");
    if (!campo) return;
    const TOTAL_2022_MILHOES = 203.1; // Censo 2022: cerca de 203,1 milhões de pessoas
    const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };

    /** Calcula % mais novos, % com a mesma idade e % mais velhos sem sobreposição. */
    function distribuicao(pct, idade) {
      const i = Math.min(Math.floor(idade / 5), pct.length - 1);
      const antes = pct.slice(0, i).reduce((s, x) => s + x, 0);
      let mesma, novos;
      if (i === pct.length - 1) {
        mesma = pct[i] / 25; // faixa 80+ distribuída ao longo de ~25 anos
        novos = antes + mesma * limitar(idade - 80, 0, 24);
      } else {
        mesma = pct[i] / 5;
        novos = antes + mesma * (idade % 5);
      }
      const velhos = Math.max(0, 100 - novos - mesma);
      return { novos, mesma, velhos };
    }

    function atualizar() {
      const idade = Math.floor(Number(campo.value));
      if (campo.value === "" || !isFinite(idade) || idade < 0 || idade > 110) {
        set("pos-novos", "—"); set("pos-velhos", "—"); set("pos-mesma", "—");
        set("pos-texto", "Digite uma idade entre 0 e 110 anos para ver o resultado.");
        return;
      }

      const d22 = distribuicao(PIRAMIDE[2022], idade);
      const d80 = distribuicao(PIRAMIDE[1980], idade);
      const milhoes = (d22.mesma / 100) * TOTAL_2022_MILHOES;

      set("pos-novos", "cerca de " + numero(d22.novos, 0) + "%");
      set("pos-velhos", "cerca de " + numero(d22.velhos, 0) + "%");
      set("pos-mesma",
        numero(milhoes, 1) + (milhoes < 2 ? " milhão" : " milhões") +
        " (" + numero(d22.mesma, 1) + "%)");

      const posicao = idade === 35
        ? "exatamente no “meio da fila”"
        : (idade > 35 ? "acima" : "abaixo") + " do “meio da fila”";

      set("pos-texto",
        "Com " + idade + (idade === 1 ? " ano" : " anos") + ", você está " + posicao +
        " do Brasil, que em 2022 ficava nos 35 anos. Em 1980, quem tinha essa idade encontrava cerca de " +
        numero(d80.novos, 0) + "% dos brasileiros mais novos que ele; em 2022, esse grupo passou para cerca de " +
        numero(d22.novos, 0) + "%. Quanto maior o salto, mais o país envelheceu.");
    }

    campo.addEventListener("input", atualizar);
    atualizar();
  }
  
  /* ======================================================================
     4. MÃO NA MASSA 2 — O BILIONÁRIO ENTRA NA SALA
     ====================================================================== */
  function iniciarSala() {
    const palco = $("sala-palco");
    if (!palco) return;

    const base = (palco.getAttribute("data-rendas") || "")
      .split(",").map((x) => parseFloat(x)).filter((x) => isFinite(x) && x >= 0);
    if (!base.length) return;

    const campo = $("bil-renda"), deslizante = $("bil-renda-range");
    let convidado = null;   // renda do convidado, ou null se ele não está na sala

    const RENDA_PADRAO = 1000000;
    const MIN = deslizante ? parseFloat(deslizante.getAttribute("data-min")) || 1000 : 1000;
    const MAX = deslizante ? parseFloat(deslizante.getAttribute("data-max")) || 1e10 : 1e10;

    // O deslizante usa "escala de zeros": cada passo multiplica o valor, senão R$ 1.000 e R$ 10 bilhões não caberiam juntos.
    const deslizanteParaValor = (p) => MIN * Math.pow(MAX / MIN, p / 100);
    const valorParaDeslizante = (v) => (Math.log(limitar(v, MIN, MAX) / MIN) / Math.log(MAX / MIN)) * 100;

    /** Arredonda para 2 algarismos "importantes" (1.234.567 → 1.200.000) para o campo não ficar com números feios. */
    function arredondar(v) {
      if (v < 100) return Math.round(v);
      const potencia = Math.pow(10, Math.floor(Math.log10(v)) - 1);
      return Math.round(v / potencia) * potencia;
    }

    function rendaDoCampo() {
      const v = campo ? parseFloat(campo.value) : RENDA_PADRAO;
      return isFinite(v) && v >= 0 ? v : RENDA_PADRAO;
    }

    function desenhar() {
      const todos = convidado == null ? base : base.concat([convidado]);
      const maior = Math.max.apply(null, todos);
      palco.innerHTML = "";
      todos.forEach((renda, i) => {
        const ehConvidado = convidado != null && i === todos.length - 1;
        const pessoa = document.createElement("div");
        pessoa.className = "sala__pessoa";
        const barra = document.createElement("div");
        barra.className = "sala__barra" + (ehConvidado ? " sala__barra--convidado" : "");
        barra.style.setProperty("--h", String(maior > 0 ? (renda / maior) * 100 : 0));
        barra.title = (ehConvidado ? "Convidado: " : "Trabalhador " + (i + 1) + ": ") + reais(renda) + " por mês";
        const valor = document.createElement("div");
        valor.className = "sala__valor";
        valor.textContent = (ehConvidado ? "convidado " : "") + reaisCurto(renda).replace("R$ ", "");
        pessoa.appendChild(barra); pessoa.appendChild(valor);
        palco.appendChild(pessoa);
      });
      palco.setAttribute("aria-label",
        "Barras mostrando a renda de cada pessoa na sala. " +
        (convidado == null ? "Há " + base.length + " trabalhadores." :
          "Há " + base.length + " trabalhadores e um convidado que ganha " + reais(convidado) + " por mês."));

      // números da sala
      const mediaAgora = media(todos), medianaAgora = mediana(todos);
      const mediaAntes = media(base), medianaAntes = mediana(base);
      const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
      set("sala-media", reais(mediaAgora));
      set("sala-mediana", reais(medianaAgora));

      if (convidado == null) {
        set("sala-texto", "Só há os " + base.length + " trabalhadores na sala. Média (" + reais(mediaAntes) +
          ") e mediana (" + reais(medianaAntes) + ") são iguais, porque ninguém está muito longe dos outros.");
      } else {
        const vezesMedia = mediaAgora / mediaAntes;
        const subiuMediana = medianaAgora - medianaAntes;
        set("sala-texto",
          "O convidado entrou! A média pulou de " + reais(mediaAntes) + " para " + reais(mediaAgora) +
          " (" + numero(vezesMedia, vezesMedia >= 10 ? 0 : 1) + " vezes maior), um valor que nenhum trabalhador recebe. " +
          "A mediana foi de " + reais(medianaAntes) + " para " + reais(medianaAgora) +
          (subiuMediana > 0 ? ": subiu só " + reais(subiuMediana) + "." : ".") +
          " Quem está no meio da fila quase não sentiu a chegada dele.");
      }
    }

    // sincroniza campo e deslizante
    function doCampoParaDeslizante() {
      if (deslizante) deslizante.value = String(Math.round(valorParaDeslizante(rendaDoCampo())));
    }
    if (campo) {
      campo.addEventListener("input", () => { doCampoParaDeslizante(); if (convidado != null) { convidado = rendaDoCampo(); desenhar(); } });
    }
    if (deslizante) {
      deslizante.addEventListener("input", () => {
        const v = arredondar(deslizanteParaValor(parseFloat(deslizante.value)));
        if (campo) campo.value = String(v);
        if (convidado != null) { convidado = v; desenhar(); }
      });
    }

    const entrar = $("bil-entrar"), sair = $("bil-sair"), reiniciar = $("sala-reiniciar");
    if (entrar) entrar.addEventListener("click", () => { convidado = rendaDoCampo(); desenhar(); });
    if (sair) sair.addEventListener("click", () => { convidado = null; desenhar(); });
    if (reiniciar) reiniciar.addEventListener("click", () => {
      convidado = null;
      if (campo) campo.value = String(RENDA_PADRAO);
      doCampoParaDeslizante();
      desenhar();
    });

    doCampoParaDeslizante();
    desenhar();
  }


  /* ======================================================================
     5. MÃO NA MASSA 3 — O BOLO E O ÍNDICE DE GINI
     ======================================================================
     Modelo simples: a curva de Lorenz L(p) = p^k, que tem Gini = (k − 1) / (k + 1).
     Então, dado o Gini G, usamos k = (1 + G) / (1 − G). A fatia da criança i
     (da mais pobre para a mais rica) é L(i/n) − L((i−1)/n). */
  function iniciarBolo() {
    const palco = $("bolo-palco"), slider = $("gini-slider");
    if (!palco || !slider) return;
    const n = parseInt(palco.getAttribute("data-fatias"), 10) || 10;
    const ESCALA_MAX_FATIA = 0.65;   // fatia de 65% do bolo = barra cheia (assim dá para comparar valores diferentes de Gini)

    function fatias(gini) {
      const g = limitar(gini, 0, 0.95);
      const k = (1 + g) / (1 - g);
      const L = (p) => Math.pow(p, k);
      const lista = [];
      for (let i = 1; i <= n; i++) lista.push(L(i / n) - L((i - 1) / n));
      return lista;
    }

    function desenhar(gini) {
      const lista = fatias(gini);
      // cria as crianças na primeira vez; depois só muda a altura (a transição do CSS anima)
      if (palco.children.length !== n) {
        palco.innerHTML = "";
        for (let i = 0; i < n; i++) {
          const c = document.createElement("div"); c.className = "bolo__crianca";
          const f = document.createElement("div"); f.className = "bolo__fatia";
          const r = document.createElement("div"); r.className = "bolo__rotulo";
          c.appendChild(f); c.appendChild(r); palco.appendChild(c);
        }
      }
      lista.forEach((fatia, i) => {
        const c = palco.children[i];
        c.firstChild.style.setProperty("--h", String(limitar((fatia / ESCALA_MAX_FATIA) * 100, 0, 100)));
        c.lastChild.textContent = numero(fatia * 100, fatia * 100 < 10 ? 1 : 0) + "%";
        c.firstChild.title = "Criança " + (i + 1) + " recebe " + numero(fatia * 100, 1) + "% do bolo";
      });

      const menor = lista[0], maior = lista[n - 1];
      const razao = menor > 0 ? maior / menor : Infinity;
      palco.setAttribute("aria-label", "Dez crianças e a fatia de bolo que cada uma recebe, da que recebe menos para a que recebe mais. Gini " + numero(gini, 2));

      const valor = $("gini-valor"); if (valor) valor.textContent = numero(gini, 2);
      const texto = $("gini-texto");
      if (texto) {
        if (gini < 0.01) {
          texto.textContent = "Com Gini 0, todas as crianças recebem exatamente o mesmo: " + numero(menor * 100, 0) + "% do bolo cada uma. É a igualdade perfeita, que não existe em país nenhum.";
        } else {
          texto.textContent = "Com Gini " + numero(gini, 2) + ", a criança que mais recebe fica com " + numero(maior * 100, 0) +
            "% do bolo, e a que menos recebe, com " + numero(menor * 100, 1) + "%. " +
            (isFinite(razao) && razao < 1000 ? "É " + numero(razao, razao >= 10 ? 0 : 1) + " vezes mais. " : "É uma diferença enorme. ") +
            "(É um modelo simples, só para sentir a ideia: o Gini real do Brasil vem de pesquisas como a PNAD.)";
        }
      }
    }

    slider.addEventListener("input", () => desenhar(parseFloat(slider.value)));
    $$(".gini-preset").forEach((b) => {
      b.addEventListener("click", () => {
        slider.value = b.getAttribute("data-gini");
        desenhar(parseFloat(slider.value));
      });
    });
    desenhar(parseFloat(slider.value));
  }


  /* ======================================================================
     6. MÃO NA MASSA 4 — CALCULADORA DO IDH
     ====================================================================== */
  function iniciarIdh() {
    const s = $("idh-saude"), e = $("idh-educacao"), r = $("idh-renda");
    if (!s || !e || !r) return;

    function faixa(v) {                      // faixas oficiais do PNUD
      if (v >= 0.8) return "Muito alto";
      if (v >= 0.7) return "Alto";
      if (v >= 0.55) return "Médio";
      return "Baixo";
    }

    function atualizar() {
      const vs = parseFloat(s.value), ve = parseFloat(e.value), vr = parseFloat(r.value);
      const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
      set("idh-saude-saida", numero(vs, 2));
      set("idh-educacao-saida", numero(ve, 2));
      set("idh-renda-saida", numero(vr, 2));

      const geometrica = Math.cbrt(vs * ve * vr);
      const aritmetica = (vs + ve + vr) / 3;
      set("idh-resultado", numero(geometrica, 3));
      set("idh-aritmetica", numero(aritmetica, 3));
      set("idh-faixa", faixa(geometrica));

      const dif = aritmetica - geometrica;
      const nomes = [["saúde", vs], ["educação", ve], ["renda", vr]].sort((a, b) => a[1] - b[1]);
      let txt;
      if (dif < 0.0005) {
        txt = "As três notas são iguais, então as duas formas de calcular dão o mesmo resultado.";
      } else {
        txt = "A média comum daria " + numero(aritmetica, 3) + ", mas o IDH usa a média geométrica e fica em " + numero(geometrica, 3) +
          ": " + numero(dif, 3) + " a menos. A nota mais baixa (" + nomes[0][0] + ", " + numero(nomes[0][1], 2) +
          ") puxa o resultado para baixo. A ideia é que uma vida boa não se compensa: um país não “paga” a falta de saúde com muita renda.";
      }
      set("idh-texto", txt);
    }

    [s, e, r].forEach((el) => el.addEventListener("input", atualizar));
    $$(".idh-preset").forEach((b) => {
      b.addEventListener("click", () => {
        s.value = b.getAttribute("data-s");
        e.value = b.getAttribute("data-e");
        r.value = b.getAttribute("data-r");
        atualizar();
      });
    });
    atualizar();
  }


  /* ======================================================================
     7. MÃO NA MASSA 5 — A RÉGUA CORTADA
     ====================================================================== */
  function iniciarEixo() {
    const svg = $("eixo-svg"), slider = $("eixo-minimo");
    if (!svg || !slider) return;

    const A = parseFloat(svg.getAttribute("data-a")), B = parseFloat(svg.getAttribute("data-b"));
    const rotA = svg.getAttribute("data-rotulo-a") || "A", rotB = svg.getAttribute("data-rotulo-b") || "B";
    if (!isFinite(A) || !isFinite(B)) return;

    // área de desenho dentro do viewBox 640 × 360
    const esq = 78, dir = 610, topo = 34, base = 298;
    const TOPO_ESCALA = Math.ceil(Math.max(A, B) * 20 + 1) / 20;   // um pouco acima da maior barra (ex.: 0,55)
    const botao = $("eixo-alternar");
    const MINIMO_MANIPULADO = 0.5;
    let cancelar = function () {};

    function desenhar(minimo) {
      while (svg.lastChild && svg.lastChild.nodeName !== "desc") svg.removeChild(svg.lastChild);

      const altura = base - topo;
      // com a régua cortada, o "teto" do gráfico chega perto da maior barra (é isso que exagera a diferença)
      const teto = minimo > 0.0001 ? Math.max(A, B) + Math.max(0.004, Math.max(A, B) - minimo) * 0.3 : TOPO_ESCALA;
      const casas = teto - minimo < 0.1 ? 3 : 2;
      const yDe = (v) => base - ((v - minimo) / (teto - minimo)) * altura;
      const g = criarSvg("g", {});
      svg.appendChild(g);

      // grade e números do eixo vertical
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const v = minimo + ((teto - minimo) * i) / ticks;
        const y = yDe(v);
        g.appendChild(criarSvg("line", { class: "grafico-grade", x1: esq, x2: dir, y1: y, y2: y }));
        g.appendChild(criarSvg("text", { class: "grafico-rotulo", x: esq - 10, y: y + 4, "text-anchor": "end" }, numero(v, casas)));
      }
      g.appendChild(criarSvg("line", { class: "grafico-eixo", x1: esq, x2: esq, y1: topo, y2: base }));
      g.appendChild(criarSvg("line", { class: "grafico-eixo", x1: esq, x2: dir, y1: base, y2: base }));

      // barras
      const largura = 120;
      const dados = [
        { v: A, rot: rotA, cx: esq + (dir - esq) * 0.3, classe: "grafico-barra grafico-barra--a" },
        { v: B, rot: rotB, cx: esq + (dir - esq) * 0.7, classe: "grafico-barra grafico-barra--b" },
      ];
      dados.forEach((d) => {
        const y = yDe(Math.max(d.v, minimo));
        const h = Math.max(0, base - y);
        g.appendChild(criarSvg("rect", { class: d.classe, x: d.cx - largura / 2, y: y, width: largura, height: h }));
        g.appendChild(criarSvg("text", { class: "grafico-valor", x: d.cx, y: Math.min(y - 8, base - 6), "text-anchor": "middle" }, numero(d.v, 3)));
        g.appendChild(criarSvg("text", { class: "grafico-rotulo", x: d.cx, y: base + 24, "text-anchor": "middle" }, d.rot));
      });

      // marca de "régua cortada": ziguezague perto da base quando o eixo não começa no zero
      if (minimo > 0.0001) {
        const zig = "M " + (esq - 8) + " " + (base - 18) + " l 8 -6 l 8 12 l 8 -12 l 8 6";
        g.appendChild(criarSvg("path", { class: "grafico-corte", d: zig }));
        g.appendChild(criarSvg("text", { class: "grafico-rotulo", x: esq + 6, y: topo - 12, fill: "currentColor" }, "⚠ régua cortada: começa em " + numero(minimo, 2)));
      }

      // textos
      const fator = A - minimo > 0.0001 ? A / (A - minimo) : Infinity;   // quantas vezes a queda parece maior do que é
      const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
      set("eixo-minimo-saida", numero(minimo, 2));
      set("eixo-fator", isFinite(fator) ? numero(fator, fator >= 10 ? 0 : 1) + " ×" : "enorme");
      slider.setAttribute("aria-valuetext", "a régua começa em " + numero(minimo, 2));
      if (botao) botao.setAttribute("aria-pressed", String(minimo > 0.0001));

      const queda = ((A - B) / A) * 100;
      let manchete, texto;
      if (minimo < 0.02) {
        manchete = "Manchete que combina com este gráfico: “Desigualdade cai um pouco”.";
        texto = "Com a régua começando no zero, o desenho mostra o que os dados mostram: uma queda pequena, de " + numero(queda, 1) + "% (de " + numero(A, 3) + " para " + numero(B, 3) + ").";
      } else if (fator < 5) {
        manchete = "Manchete que combina com este gráfico: “Desigualdade cai”.";
        texto = "A régua já foi cortada em " + numero(minimo, 2) + ". A queda real continua de " + numero(queda, 1) + "%, mas no desenho ela parece cerca de " + numero(fator, 1) + " vezes maior.";
      } else {
        manchete = "Manchete que combina com este gráfico: “Desigualdade despenca!”.";
        texto = "Os números escritos são os mesmos, mas a régua começa em " + numero(minimo, 2) + " e a barra de " + rotB +
          " parece muito menor que a de " + rotA + ". A queda de " + numero(queda, 1) + "% ganhou cara de desabamento: o desenho exagera cerca de " + numero(fator, 0) + " vezes. É assim que um gráfico engana sem mentir em nenhum número.";
      }
      set("eixo-manchete", manchete);
      set("eixo-texto", texto);
    }

    slider.addEventListener("input", () => { cancelar(); desenhar(parseFloat(slider.value)); });
    if (botao) {
      botao.addEventListener("click", () => {
        const de = parseFloat(slider.value);
        const para = de > 0.0001 ? 0 : MINIMO_MANIPULADO;
        cancelar();
        cancelar = animar([de], [para], 500, (v) => { slider.value = String(v[0]); desenhar(v[0]); }, () => {
          slider.value = String(para); desenhar(para);
        });
      });
    }
    desenhar(parseFloat(slider.value));
  }


  /* ======================================================================
     8. MÃO NA MASSA 6 — DESENHOS QUE CRESCEM DEMAIS
     ====================================================================== */
  function iniciarDesenhos() {
    const svg = $("pict-svg"), slider = $("pict-fator");
    if (!svg || !slider) return;
    const radios = $$('input[name="pict-modo"]');

    const lado = 60, base = 270;   // o desenho original é um quadrado de 60 e fica "apoiado" na linha y = 270

    function modoAtual() {
      const marcado = radios.find((r) => r.checked);
      return marcado ? marcado.value : "proporcional";
    }

    function desenhar() {
      while (svg.lastChild && svg.lastChild.nodeName !== "desc") svg.removeChild(svg.lastChild);
      const f = parseFloat(slider.value);
      const modo = modoAtual();

      // honesto: só a altura cresce (área × f). enganoso: altura e largura crescem (área × f²)
      const larguraNovo = modo === "proporcional" ? lado * f : lado;
      const alturaNovo = lado * f;
      const areaVezes = (larguraNovo * alturaNovo) / (lado * lado);

      const g = criarSvg("g", {});
      svg.appendChild(g);
      g.appendChild(criarSvg("line", { class: "grafico-eixo", x1: 30, x2: 610, y1: base, y2: base }));

      const x1 = 130, x2 = 330;
      g.appendChild(criarSvg("rect", { class: "pict-forma pict-forma--original", x: x1, y: base - lado, width: lado, height: lado, rx: 4 }));
      g.appendChild(criarSvg("rect", { class: "pict-forma pict-forma--novo", x: x2, y: base - alturaNovo, width: larguraNovo, height: alturaNovo, rx: 4 }));
      g.appendChild(criarSvg("text", { class: "pict-rotulo", x: x1 + lado / 2, y: base + 20, "text-anchor": "middle" }, "valor real: 1"));
      g.appendChild(criarSvg("text", { class: "pict-rotulo", x: x2 + larguraNovo / 2, y: base + 20, "text-anchor": "middle" }, "valor real: " + numero(f, f % 1 ? 1 : 0)));

      const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
      set("pict-fator-saida", numero(f, f % 1 ? 1 : 0));
      set("pict-area", numero(areaVezes, areaVezes % 1 ? 1 : 0) + (areaVezes === 1 ? " vez" : " vezes"));

      const fTxt = numero(f, f % 1 ? 1 : 0);
      if (f === 1) {
        set("pict-texto", "Com o valor real igual (1 para 1), os dois desenhos são iguais. Aumente o deslizante para ver o que acontece.");
      } else if (modo === "altura") {
        set("pict-texto", "O número real cresceu " + fTxt + " vezes e o desenho também: só a altura aumentou, então a área ficou " + fTxt + " vezes maior. O olho entende certo.");
      } else {
        set("pict-texto", "O número real cresceu " + fTxt + " vezes, mas o desenho cresceu para os dois lados e ocupa " + numero(areaVezes, areaVezes % 1 ? 1 : 0) +
          " vezes mais espaço. O olho enxerga a área, não a altura, e entende “" + numero(areaVezes, areaVezes % 1 ? 1 : 0) + " vezes”.");
      }
      svg.setAttribute("aria-label", "Dois quadrados: o original e outro com área " + numero(areaVezes, 1) + " vezes maior");
    }

    slider.addEventListener("input", desenhar);
    radios.forEach((r) => r.addEventListener("change", desenhar));
    desenhar();
  }


  /* ======================================================================
     9. LISTA DE VERIFICAÇÃO E MINI-TESTE
     ====================================================================== */
  function iniciarChecklist() {
    const caixas = $$('.checklist input[type="checkbox"]');
    if (!caixas.length) return;
    const barra = $("check-progresso"), texto = $("check-texto");

    function atualizar() {
      const marcadas = caixas.filter((c) => c.checked).length;
      const total = caixas.length;
      if (barra) {
        barra.max = total; barra.value = marcadas;
        barra.textContent = marcadas + " de " + total;
      }
      if (texto) {
        if (marcadas === 0) texto.textContent = "Você marcou 0 das " + total + " perguntas. Use a lista da próxima vez que um número chegar até você.";
        else if (marcadas < total) texto.textContent = "Você marcou " + marcadas + " de " + total + " perguntas. Falta pouco!";
        else texto.textContent = "Você marcou as " + total + " perguntas. Parabéns: com esse hábito, fica bem mais difícil enganar você com um número ou um gráfico.";
      }
    }
    caixas.forEach((c) => c.addEventListener("change", atualizar));
    atualizar();
  }

  function iniciarQuiz() {
    const form = $("quiz");
    if (!form) return;
    const perguntas = $$(".quiz-pergunta", form);
    const botao = $("quiz-corrigir"), resultado = $("quiz-resultado");

    function limpar(p) {
      p.classList.remove("correta", "errada");
      $$("label", p).forEach((l) => l.classList.remove("correta", "errada"));
    }

    // se o leitor muda uma resposta depois de corrigir, a marcação daquela pergunta some
    perguntas.forEach((p) => $$('input[type="radio"]', p).forEach((r) => r.addEventListener("change", () => limpar(p))));

    function corrigir() {
      let acertos = 0, semResposta = 0;
      perguntas.forEach((p) => {
        limpar(p);
        const certa = p.getAttribute("data-correta");
        const marcada = $$('input[type="radio"]', p).find((r) => r.checked);
        if (!marcada) { semResposta++; return; }
        const rotuloMarcado = marcada.closest("label");
        if (marcada.value === certa) {
          acertos++;
          p.classList.add("correta");
          if (rotuloMarcado) rotuloMarcado.classList.add("correta");
        } else {
          p.classList.add("errada");
          if (rotuloMarcado) rotuloMarcado.classList.add("errada");
          const certo = $$('input[type="radio"]', p).find((r) => r.value === certa);
          if (certo && certo.closest("label")) certo.closest("label").classList.add("correta");
        }
        // mostra a explicação de quem respondeu
        const detalhe = p.querySelector(".resposta-detalhe");
        if (detalhe) detalhe.open = true;
      });

      const total = perguntas.length;
      if (!resultado) return;
      if (semResposta === total) {
        resultado.textContent = "Escolha uma resposta em cada pergunta e aperte o botão de novo.";
      } else if (semResposta > 0) {
        resultado.textContent = "Você acertou " + acertos + " de " + (total - semResposta) + " respondidas. " + (semResposta === 1 ? "Falta 1 pergunta sem resposta." : "Faltam " + semResposta + " perguntas sem resposta.");
      } else if (acertos === total) {
        resultado.textContent = "Você acertou " + acertos + " de " + total + ". Difícil de enganar!";
      } else if (acertos === 0) {
        resultado.textContent = "Você acertou 0 de " + total + ". Sem problema: abra as explicações, elas mostram o raciocínio, e tente de novo.";
      } else {
        resultado.textContent = "Você acertou " + acertos + " de " + total + ". Leia as explicações das que errou e tente de novo.";
      }
    }

    if (botao) botao.addEventListener("click", corrigir);
    form.addEventListener("submit", (e) => { e.preventDefault(); corrigir(); });
  }

/* ======================================================================
     EXTRA — CARTAS À REDAÇÃO (ENVIA PARA O E-MAIL VIA WEB3FORMS)
     ====================================================================== */
  function iniciarCartas() {
    const form = $("form-cartas");
    const grupo = $("cartas-estrelas");
    if (!form || !grupo) return;

    const WEB3FORMS_CHAVE = "6c94aa68-180a-4853-9063-f5aa2adab3b3";
    const CHAVE_LOCAL = "conta-de-gente-cartas-v1";

    const estrelas = $$(".estrela", grupo);
    const notaTexto = $("cartas-nota-texto");
    const campoNome = $("cartas-nome");
    const campoTexto = $("cartas-texto");
    const btnEnviar = $("cartas-enviar");
    const aviso = $("cartas-aviso");
    const mural = $("cartas-mural");
    const listaEl = $("cartas-lista");
    const btnLimpar = $("cartas-limpar");

    const LEGENDA = {
      1: "1 de 5 estrelas — Precisa melhorar",
      2: "2 de 5 estrelas — Regular",
      3: "3 de 5 estrelas — Boa edição",
      4: "4 de 5 estrelas — Muito boa",
      5: "5 de 5 estrelas — Excelente!",
    };

    let notaAtual = 0;

    function lerSalvas() {
      try {
        const bruto = localStorage.getItem(CHAVE_LOCAL);
        const dados = bruto ? JSON.parse(bruto) : [];
        return Array.isArray(dados) ? dados : [];
      } catch (e) {
        return [];
      }
    }

    function salvar(lista) {
      try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista)); } catch (e) {}
    }

    let cartas = lerSalvas();

    function pintar(qtd, classe) {
      estrelas.forEach((btn, i) => {
        const ligar = i < qtd;
        if (classe === "preview") {
          btn.classList.toggle("preview", ligar);
        } else {
          btn.classList.remove("preview");
          btn.classList.toggle("ativa", ligar);
          btn.setAttribute("aria-pressed", i + 1 === qtd ? "true" : "false");
        }
      });
    }

    estrelas.forEach((btn) => {
      const valor = Number(btn.getAttribute("data-nota"));
      btn.addEventListener("mouseenter", () => pintar(valor, "preview"));
      btn.addEventListener("click", () => {
        notaAtual = valor;
        pintar(notaAtual, "ativa");
        if (notaTexto) notaTexto.textContent = LEGENDA[notaAtual] || "";
        if (aviso) aviso.textContent = "";
      });
    });

    grupo.addEventListener("mouseleave", () => {
      estrelas.forEach((b) => b.classList.remove("preview"));
    });

    function renderizar() {
      if (!mural || !listaEl) return;
      listaEl.textContent = "";
      if (cartas.length === 0) {
        mural.hidden = true;
        return;
      }
      mural.hidden = false;
      cartas.forEach((item) => {
        const li = document.createElement("li");
        li.className = "carta";

        const topo = document.createElement("div");
        topo.className = "carta__topo";

        const meta = document.createElement("span");
        meta.className = "carta__meta";
        const strong = document.createElement("strong");
        strong.textContent = item.nome;
        meta.appendChild(strong);
        meta.appendChild(document.createTextNode(" · " + item.data));

        const est = document.createElement("span");
        est.className = "carta__estrelas";
        est.setAttribute("aria-label", item.nota + " de 5 estrelas");
        est.textContent = "★".repeat(item.nota) + "☆".repeat(5 - item.nota);

        topo.appendChild(meta);
        topo.appendChild(est);
        li.appendChild(topo);

        if (item.texto) {
          const p = document.createElement("p");
          p.className = "carta__texto";
          p.textContent = item.texto;
          li.appendChild(p);
        }
        listaEl.appendChild(li);
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!notaAtual) {
        if (aviso) aviso.textContent = "Selecione de 1 a 5 estrelas antes de enviar.";
        return;
      }

      const nome = (campoNome && campoNome.value.trim().slice(0, 60)) || "Leitor(a) anônimo(a)";
      const texto = campoTexto ? campoTexto.value.trim().slice(0, 500) : "";

      if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.textContent = "Enviando...";
      }
      if (aviso) aviso.textContent = "Enviando sua avaliação para a redação...";

      try {
        const resposta = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_CHAVE,
            subject: "Nova avaliação na revista Conta de Gente (" + notaAtual + "/5)",
            from_name: "Revista Conta de Gente",
            Nome: nome,
            Nota: notaAtual + " de 5 estrelas",
            Sugestao: texto || "(Sem comentário escrito)",
          }),
        });

        const dados = await resposta.json();
        if (!resposta.ok || !dados.success) {
          throw new Error(dados.message || "Falha no envio");
        }

        cartas.unshift({
          nota: notaAtual,
          nome: nome,
          texto: texto,
          data: new Date().toLocaleDateString("pt-BR"),
        });
        salvar(cartas);
        renderizar();

        notaAtual = 0;
        pintar(0, "ativa");
        if (notaTexto) notaTexto.textContent = "Clique em uma estrela para dar sua nota.";
        if (campoNome) campoNome.value = "";
        if (campoTexto) campoTexto.value = "";
        if (aviso) aviso.textContent = "Obrigado! Sua avaliação foi enviada para a redação.";
      } catch (erro) {
        if (aviso) aviso.textContent = "Não foi possível enviar agora. Verifique sua conexão e tente novamente.";
      } finally {
        if (btnEnviar) {
          btnEnviar.disabled = false;
          btnEnviar.textContent = "Enviar avaliação";
        }
      }
    });

    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => {
        cartas = [];
        try { localStorage.removeItem(CHAVE_LOCAL); } catch (e) {}
        renderizar();
        if (aviso) aviso.textContent = "Registros deste navegador removidos.";
      });
    }

    renderizar();
  }

  /* ======================================================================
     10. PARTIDA
     Cada ferramenta é ligada dentro de um "try": se uma delas der erro, as outras continuam funcionando.
     ====================================================================== */
  function iniciar() {
    [
      iniciarTema, iniciarFonte, iniciarImpressao, iniciarTopo,
      iniciarProgresso, iniciarMenu,
      iniciarPiramide, iniciarPosicao, iniciarSala, iniciarBolo, iniciarIdh, iniciarEixo, iniciarDesenhos,
      iniciarChecklist, iniciarQuiz, iniciarCartas,
    ].forEach((funcao) => {
      try { funcao(); } catch (erro) {
        if (window.console) console.error("[Conta de Gente] Erro em " + funcao.name + ":", erro);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
