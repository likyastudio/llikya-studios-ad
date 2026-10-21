'use strict';
/* Sayı Kulesi — Likya Studios
   Bölüm 1: oyun mantığı (DOM'a dokunmaz, Node'da test edilir)
   Bölüm 2: arayüz, animasyon, ses, depolama */

/* ===================== 1) OYUN MANTIĞI ===================== */
const Core = (() => {
  const COLS = 5;
  const ROWS = 7;
  const WIN = 2048;
  const P_FOUR = 0.3; // sıradaki bloğun 4 gelme olasılığı

  // Birleşme önceliği: alt, sol, sağ, üst. Alt komşu varsa birleşme alttaki hücrede olur.
  const DIRS = [
    ['below', 0, -1],
    ['left', -1, 0],
    ['right', 1, 0],
    ['above', 0, 1],
  ];

  const pickNext = (rng) => (rng() < P_FOUR ? 4 : 2);

  function createGame(opts = {}) {
    const rng = opts.rng || Math.random;
    return {
      cols: Array.from({ length: COLS }, () => []), // cols[c][r]: r=0 en alt hücre, her hücre {id, v}
      score: 0,
      next: pickNext(rng),
      won: false,
      over: false,
      nextId: 1,
      rng,
    };
  }

  // Test ve hata ayıklama için hazır sütunlardan oyun kurar (değerler alttan üste).
  function fromColumns(columns, opts = {}) {
    const state = createGame(opts);
    columns.forEach((values, c) => {
      values.forEach((v) => state.cols[c].push({ id: state.nextId++, v }));
    });
    if (opts.next) state.next = opts.next;
    state.score = opts.score || 0;
    state.won = !!opts.won;
    state.over = isFull(state);
    return state;
  }

  function isFull(state) {
    return state.cols.every((col) => col.length >= ROWS);
  }

  function canDrop(state, c) {
    return !state.over && Number.isInteger(c) && c >= 0 && c < COLS && state.cols[c].length < ROWS;
  }

  function cellAt(state, c, r) {
    const col = state.cols[c];
    return col && r >= 0 ? col[r] : undefined;
  }

  function find(state, id) {
    for (let c = 0; c < COLS; c++) {
      const r = state.cols[c].findIndex((b) => b.id === id);
      if (r !== -1) return { c, r };
    }
    return null;
  }

  // Yan yana veya üst üste eşit çifti olan ilk bloğun kimliği (yoksa null).
  function findAnyPair(state) {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < state.cols[c].length; r++) {
        const v = state.cols[c][r].v;
        const right = cellAt(state, c + 1, r);
        const below = cellAt(state, c, r - 1);
        if ((right && right.v === v) || (below && below.v === v)) return state.cols[c][r].id;
      }
    }
    return null;
  }

  // Bırakılan bloktan başlayarak birleşmeleri ve yerçekimini adım adım çözer.
  // Her birleşme tek bir çift içindir: x + x = 2x. Toplam değer korunur.
  function resolve(state, startId) {
    const steps = [];
    let chain = 0;
    let reachedWin = false;
    const stack = [startId];

    const run = () => {
      while (stack.length) {
        const id = stack.pop();
        const pos = find(state, id);
        if (!pos) continue; // bu blok başka bir birleşmede zaten yok oldu
        const block = state.cols[pos.c][pos.r];

        let hit = null;
        for (const [kind, dc, dr] of DIRS) {
          const other = cellAt(state, pos.c + dc, pos.r + dr);
          if (other && other.v === block.v) {
            hit = { kind, other, c: pos.c + dc, r: pos.r + dr };
            break;
          }
        }
        if (!hit) continue;

        const self = { block, c: pos.c, r: pos.r };
        const that = { block: hit.other, c: hit.c, r: hit.r };
        const keep = hit.kind === 'below' ? that : self; // kalan blok
        const gone = hit.kind === 'below' ? self : that; // kaybolan blok

        keep.block.v *= 2;
        state.cols[gone.c].splice(gone.r, 1);
        const falls = state.cols[gone.c].slice(gone.r).map((b, i) => ({
          id: b.id,
          col: gone.c,
          from: gone.r + i + 1,
          to: gone.r + i,
        }));

        chain += 1;
        const value = keep.block.v;
        const points = value * chain; // zincirin her halkası bir öncekinden daha çok puan verir
        state.score += points;
        if (value >= WIN && !state.won) {
          state.won = true;
          reachedWin = true;
        }

        steps.push({
          type: 'merge',
          kind: hit.kind,
          keep: { id: keep.block.id, col: keep.c, row: keep.r },
          remove: { id: gone.block.id, col: gone.c, row: gone.r },
          value,
          chain,
          points,
          falls,
        });

        for (let i = falls.length - 1; i >= 0; i--) stack.push(falls[i].id);
        stack.push(keep.block.id);
      }
    };

    run();
    // Güvenlik ağı: normal oyunda gerekmez, elle kurulmuş kararsız tahtaları da toparlar.
    for (let id = findAnyPair(state); id !== null; id = findAnyPair(state)) {
      stack.push(id);
      run();
    }
    return { steps, chain, reachedWin };
  }

  function drop(state, c) {
    if (state.over) return { ok: false, reason: 'over' };
    if (!Number.isInteger(c) || c < 0 || c >= COLS) return { ok: false, reason: 'range' };
    if (state.cols[c].length >= ROWS) return { ok: false, reason: 'full' };

    const before = state.score;
    const value = state.next;
    const block = { id: state.nextId++, v: value };
    state.cols[c].push(block);

    const steps = [{ type: 'place', id: block.id, col: c, row: state.cols[c].length - 1, value }];
    const out = resolve(state, block.id);
    steps.push(...out.steps);

    state.next = pickNext(state.rng);
    state.over = isFull(state);

    return {
      ok: true,
      placed: value,
      steps,
      gained: state.score - before,
      chain: out.chain,
      won: out.reachedWin,
      over: state.over,
    };
  }

  return { COLS, ROWS, WIN, createGame, fromColumns, canDrop, drop, isFull };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Core };

/* ===================== 2) ARAYÜZ ===================== */
if (typeof document !== 'undefined') {
  const $ = (id) => document.getElementById(id);
  const el = {
    board: $('board'),
    grid: $('grid'),
    blocks: $('blocks'),
    fx: $('fx'),
    cols: $('cols'),
    score: $('score'),
    best: $('best'),
    nextTile: $('nextTile'),
    combo: $('combo'),
    restart: $('restartBtn'),
    sound: $('soundBtn'),
    startOv: $('startOverlay'),
    startBtn: $('startBtn'),
    overOv: $('overOverlay'),
    overScore: $('overScore'),
    overRecord: $('overRecord'),
    againBtn: $('againBtn'),
    winOv: $('winOverlay'),
    continueBtn: $('continueBtn'),
    winRestartBtn: $('winRestartBtn'),
  };

  const STORE_BEST = 'sayiKulesi.best';
  const STORE_SOUND = 'sayiKulesi.sound';
  const store = {
    get(k) {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    },
    set(k, v) {
      try { localStorage.setItem(k, String(v)); } catch (e) { /* özel pencere vb. */ }
    },
  };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SLIDE = reduceMotion ? 60 : 170; // blok kayma süresi (ms)
  const POP = reduceMotion ? 40 : 150; // birleşme sonrası bekleme (ms)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => n.toLocaleString('tr-TR');

  let game = null;
  let gen = 0; // yeniden başlatınca eski animasyon döngüsünü iptal eder
  let busy = true; // hamle animasyonu veya pencere açıkken giriş kilitli
  let modalOpen = false;
  let best = Math.max(0, parseInt(store.get(STORE_BEST), 10) || 0);
  let bestAtStart = best;
  let shownScore = 0;
  let soundOn = store.get(STORE_SOUND) !== '0';
  const nodes = new Map(); // blok kimliği -> DOM öğesi

  /* ---------- Ses (WebAudio, dosyasız) ---------- */
  const sfx = (() => {
    let ctx = null;
    const ensure = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const tone = (freq, dur, type, vol, delay = 0, slideTo = 0) => {
      if (!soundOn) return;
      const c = ensure();
      if (!c) return;
      const t = c.currentTime + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };
    const note = (semi) => 330 * Math.pow(2, semi / 12);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    return {
      unlock: ensure,
      drop: () => tone(180, 0.09, 'sine', 0.16, 0, 90),
      merge: (chain) => {
        const s = scale[Math.min(chain - 1, scale.length - 1)];
        tone(note(s), 0.18, 'triangle', 0.14);
        tone(note(s + 7), 0.22, 'sine', 0.07, 0.04);
      },
      deny: () => tone(110, 0.14, 'square', 0.05, 0, 80),
      win: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(note(s + 12), 0.3, 'triangle', 0.13, i * 0.09)),
      over: () => [7, 4, 0, -5].forEach((s, i) => tone(note(s), 0.32, 'sine', 0.12, i * 0.14)),
    };
  })();

  /* ---------- Blok DOM'u ---------- */
  function makeBlock() {
    const node = document.createElement('div');
    node.className = 'block';
    const face = document.createElement('div');
    face.className = 'face';
    face.appendChild(document.createElement('span'));
    node.appendChild(face);
    node._face = face;
    return node;
  }

  function placeNode(node, col, row) {
    node.style.setProperty('--c', col);
    node.style.setProperty('--r', row);
  }

  function paintFace(node, v) {
    node.dataset.v = v > 2048 ? 'big' : String(v);
    node.dataset.len = String(String(v).length);
    node._face.firstChild.textContent = v;
  }

  function createNode(b, col, row) {
    const node = makeBlock();
    paintFace(node, b.v);
    placeNode(node, col, row);
    el.blocks.appendChild(node);
    nodes.set(b.id, node);
    return node;
  }

  // Ekranı oyun durumuyla birebir eşitler (hamle sonunda ve yüklemede).
  function syncAll() {
    const live = new Set();
    game.cols.forEach((col, c) => {
      col.forEach((b, r) => {
        live.add(b.id);
        let node = nodes.get(b.id);
        if (!node) node = createNode(b, c, r);
        paintFace(node, b.v);
        placeNode(node, c, r);
        node.style.opacity = '';
      });
    });
    for (const [id, node] of nodes) {
      if (!live.has(id)) {
        node.remove();
        nodes.delete(id);
      }
    }
  }

  function clearBlocks() {
    el.blocks.textContent = '';
    nodes.clear();
  }

  /* ---------- HUD ---------- */
  function renderScore() {
    el.score.textContent = fmt(shownScore);
    el.score.dataset.value = shownScore;
  }

  function renderBest() {
    el.best.textContent = fmt(best);
    el.best.dataset.value = best;
  }

  function renderNext() {
    const v = game ? game.next : 2;
    el.nextTile.dataset.v = String(v);
    el.nextTile.dataset.len = String(String(v).length);
    el.nextTile.querySelector('span').textContent = v;
    el.nextTile.dataset.value = v;
  }

  function renderColumns() {
    [...el.cols.children].forEach((btn, c) => {
      const full = game && game.cols[c].length >= Core.ROWS;
      btn.setAttribute('aria-disabled', full ? 'true' : 'false');
      btn.classList.toggle('full', !!full);
      btn.setAttribute('aria-label', `${c + 1}. sütun${full ? ', dolu' : ''}`);
    });
  }

  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  let comboTimer = 0;
  function flash(text, kind) {
    el.combo.textContent = text;
    el.combo.className = `combo show ${kind || ''}`;
    el.combo.classList.remove('pulse');
    void el.combo.offsetWidth;
    el.combo.classList.add('pulse');
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      el.combo.className = 'combo';
    }, 1100);
  }

  /* ---------- Efektler ---------- */
  function centerOf(node) {
    const b = el.board.getBoundingClientRect();
    const n = node.getBoundingClientRect();
    return { x: n.left - b.left + n.width / 2, y: n.top - b.top + n.height / 2, size: n.width };
  }

  function sparks(node) {
    if (reduceMotion) return;
    const { x, y, size } = centerOf(node);
    const color = getComputedStyle(node._face).getPropertyValue('--tile').trim() || '#fff';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.background = color;
      el.fx.appendChild(s);
      const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      const dist = size * (0.55 + Math.random() * 0.5);
      const anim = s.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(.15)`, opacity: 0 },
        ],
        { duration: 450 + Math.random() * 250, easing: 'cubic-bezier(.2,.7,.3,1)' }
      );
      anim.onfinish = () => s.remove();
    }
  }

  function floatPoints(node, points) {
    const { x, y } = centerOf(node);
    const t = document.createElement('b');
    t.className = 'float';
    t.textContent = '+' + fmt(points);
    t.style.left = x + 'px';
    t.style.top = y + 'px';
    el.fx.appendChild(t);
    const anim = t.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.8)', opacity: 0 },
        { transform: 'translate(-50%,-90%) scale(1.1)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%,-190%) scale(1)', opacity: 0 },
      ],
      { duration: reduceMotion ? 300 : 800, easing: 'ease-out' }
    );
    anim.onfinish = () => t.remove();
  }

  /* ---------- Hamle animasyonu ---------- */
  async function animPlace(step) {
    const node = createNode({ id: step.id, v: step.value }, step.col, Core.ROWS);
    node.style.opacity = '0';
    void node.offsetWidth;
    const dist = Core.ROWS - step.row;
    const dur = reduceMotion ? 60 : 130 + dist * 28;
    node.style.setProperty('--dur', dur + 'ms');
    placeNode(node, step.col, step.row);
    node.style.opacity = '1';
    sfx.drop();
    await sleep(dur);
    node.style.setProperty('--dur', '');
    node._face.classList.remove('land');
    void node._face.offsetWidth;
    node._face.classList.add('land');
  }

  async function animMerge(step) {
    const keepNode = nodes.get(step.keep.id);
    const goneNode = nodes.get(step.remove.id);
    if (!keepNode || !goneNode) return;

    goneNode.classList.add('absorb');
    placeNode(goneNode, step.keep.col, step.keep.row);
    step.falls.forEach((f) => {
      const n = nodes.get(f.id);
      if (n) placeNode(n, f.col, f.to);
    });
    await sleep(SLIDE);

    goneNode.remove();
    nodes.delete(step.remove.id);
    paintFace(keepNode, step.value);
    keepNode._face.classList.remove('pop');
    void keepNode._face.offsetWidth;
    keepNode._face.classList.add('pop');
    sparks(keepNode);
    floatPoints(keepNode, step.points);
    sfx.merge(step.chain);
    if (step.chain >= 2) flash(`KOMBO ×${step.chain}`, 'combo-on');
    shownScore += step.points;
    renderScore();
    bump(el.score);
    await sleep(POP);
  }

  async function playMove(c) {
    if (busy || modalOpen || !game) return;
    if (!Core.canDrop(game, c)) {
      denyColumn(c);
      return;
    }
    busy = true;
    const mine = gen;
    const g = game;
    const res = Core.drop(g, c);
    // Durum anında kesinleşir; rekor animasyondan önce kalıcı kaydedilir.
    if (g.score > best) {
      best = g.score;
      store.set(STORE_BEST, best);
    }
    renderNext();

    for (const step of res.steps) {
      if (mine !== gen) return;
      if (step.type === 'place') await animPlace(step);
      else await animMerge(step);
    }
    if (mine !== gen) return;

    shownScore = g.score;
    renderScore();
    renderBest();
    renderColumns();
    syncAll();

    if (res.won) {
      sfx.win();
      openModal(el.winOv, el.continueBtn);
      return;
    }
    if (res.over) {
      showGameOver();
      return;
    }
    busy = false;
  }

  function denyColumn(c) {
    const btn = el.cols.children[c];
    if (!btn) return;
    btn.classList.remove('deny');
    void btn.offsetWidth;
    btn.classList.add('deny');
    sfx.deny();
    flash('Bu sütun dolu', 'warn');
  }

  /* ---------- Pencereler ---------- */
  function openModal(node, focusEl) {
    modalOpen = true;
    busy = true;
    node.hidden = false;
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

  function closeModal(node) {
    node.hidden = true;
    modalOpen = false;
  }

  function showGameOver() {
    sfx.over();
    el.overScore.textContent = fmt(game.score);
    const record = game.score > 0 && game.score > bestAtStart;
    el.overRecord.hidden = !record;
    openModal(el.overOv, el.againBtn);
  }

  /* ---------- Oyun akışı ---------- */
  function newGame() {
    gen += 1;
    [el.startOv, el.overOv, el.winOv].forEach((n) => { n.hidden = true; });
    modalOpen = false;
    clearTimeout(comboTimer);
    el.combo.className = 'combo';
    el.fx.textContent = '';
    game = Core.createGame();
    bestAtStart = best;
    shownScore = 0;
    clearBlocks();
    renderScore();
    renderBest();
    renderNext();
    renderColumns();
    busy = false;
  }

  // Dışarıdan hazır durum yükler (test ve hata ayıklama için).
  function load(state) {
    gen += 1;
    [el.startOv, el.overOv, el.winOv].forEach((n) => { n.hidden = true; });
    modalOpen = false;
    el.fx.textContent = '';
    game = state;
    bestAtStart = best;
    shownScore = state.score;
    clearBlocks();
    syncAll();
    renderScore();
    renderBest();
    renderNext();
    renderColumns();
    busy = false;
  }

  function renderSoundButton() {
    el.sound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    el.sound.setAttribute('aria-label', soundOn ? 'Sesi kapat' : 'Sesi aç');
    el.sound.classList.toggle('off', !soundOn);
  }

  /* ---------- Kurulum ---------- */
  for (let i = 0; i < Core.ROWS * Core.COLS; i++) el.grid.appendChild(document.createElement('i'));
  for (let c = 0; c < Core.COLS; c++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'col-btn';
    btn.dataset.key = c + 1;
    btn.addEventListener('click', () => playMove(c));
    el.cols.appendChild(btn);
  }

  el.startBtn.addEventListener('click', () => {
    sfx.unlock();
    newGame();
  });
  el.againBtn.addEventListener('click', () => { sfx.unlock(); newGame(); });
  el.winRestartBtn.addEventListener('click', () => { sfx.unlock(); newGame(); });
  el.restart.addEventListener('click', () => { sfx.unlock(); newGame(); });
  el.continueBtn.addEventListener('click', () => {
    closeModal(el.winOv);
    if (game.over) showGameOver();
    else busy = false;
  });
  el.sound.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set(STORE_SOUND, soundOn ? '1' : '0');
    renderSoundButton();
    if (soundOn) { sfx.unlock(); sfx.merge(1); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key >= '1' && e.key <= '5') {
      if (modalOpen) return;
      e.preventDefault();
      sfx.unlock();
      playMove(Number(e.key) - 1);
    }
  });

  // Çift dokunuşla yakınlaştırma ve sürükleyerek kaydırma engellenir.
  el.board.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  renderSoundButton();
  renderBest();
  renderScore();
  game = Core.createGame();
  renderNext();
  renderColumns();
  openModal(el.startOv, el.startBtn);

  window.SayiKulesi = { Core, load, getState: () => game, isBusy: () => busy };
}
