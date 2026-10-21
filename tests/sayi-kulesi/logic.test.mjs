// Çalıştır: node --test tests/sayi-kulesi/logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { Core } = createRequire(import.meta.url)('../../sayi-kulesi/game.js');

const vals = (s) => s.cols.map((col) => col.map((b) => b.v));
const sum = (s) => s.cols.flat().reduce((a, b) => a + b.v, 0);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('1. blok seçilen sütunun en alt boş hücresine yerleşir', () => {
  const s = Core.fromColumns([[], [], [], [], []], { next: 2 });
  const r = Core.drop(s, 2);
  assert.equal(r.ok, true);
  assert.deepEqual(vals(s), [[], [], [2], [], []]);
  s.next = 4;
  Core.drop(s, 2);
  assert.deepEqual(vals(s), [[], [], [2, 4], [], []]);
  assert.equal(r.steps[0].type, 'place');
  assert.equal(r.steps[0].col, 2);
  assert.equal(r.steps[0].row, 0);
});

test('2. eşit sayılar birleşir, birleşme alttaki hücrede olur', () => {
  const s = Core.fromColumns([[], [2], [], [], []], { next: 2 });
  const lowerId = s.cols[1][0].id;
  const r = Core.drop(s, 1);
  assert.deepEqual(vals(s), [[], [4], [], [], []]);
  assert.equal(s.cols[1][0].id, lowerId); // alttaki blok kalır
  assert.equal(s.score, 4);
  assert.equal(r.steps[1].kind, 'below');
  for (const [a, b] of [[4, 8], [8, 16], [16, 32], [32, 64], [64, 128]]) {
    const t = Core.fromColumns([[a]], { next: a });
    t.next = a;
    Core.drop(t, 0);
    assert.deepEqual(vals(t)[0], [b]);
  }
});

test('3. eşit olmayan blok birleşmez (çapraz komşu da birleşmez)', () => {
  const s = Core.fromColumns([[4], [8], [], [], []], { next: 2 });
  const r = Core.drop(s, 0);
  assert.deepEqual(vals(s), [[4, 2], [8], [], [], []]);
  assert.equal(r.chain, 0);
  assert.equal(s.score, 0);
  const t = Core.fromColumns([[4], [2], [], [], []], { next: 2 }); // (1,0)=2 yalnızca çapraz
  assert.equal(Core.drop(t, 0).chain, 0);
  assert.deepEqual(vals(t).slice(0, 2), [[4, 2], [2]]);
});

test('4. zincirleme birleşme ve puanlama', () => {
  const s = Core.fromColumns([[8, 4, 2]], { next: 2 });
  const r = Core.drop(s, 0);
  assert.deepEqual(vals(s)[0], [16]);
  assert.equal(r.chain, 3);
  assert.deepEqual(r.steps.filter((x) => x.type === 'merge').map((x) => x.points), [4, 16, 48]);
  assert.equal(s.score, 68);
  assert.equal(r.gained, 68);
});

test('4b. yatay birleşme ve yerçekimi: komşu sütunun üstündekiler düşer', () => {
  const s = Core.fromColumns([[8, 4, 2], [2]], { next: 4 });
  const before = sum(s) + 4;
  Core.drop(s, 1);
  assert.deepEqual(vals(s).slice(0, 2), [[8, 2], [2, 8]]);
  assert.equal(sum(s), before); // toplam değer korunur
  assert.equal(s.score, 8);
});

test('4c. yerçekiminden sonra yeni birleşme zinciri', () => {
  const s = Core.fromColumns([[8, 4, 8], [2]], { next: 4 });
  const before = sum(s) + 4;
  const r = Core.drop(s, 1);
  assert.deepEqual(vals(s).slice(0, 2), [[8], [2, 16]]);
  assert.equal(s.score, 8 + 16 * 2);
  assert.equal(r.chain, 2);
  assert.equal(sum(s), before);
});

test('5. dolu sütuna blok bırakılamaz', () => {
  const full = [2, 4, 2, 4, 2, 4, 2];
  const s = Core.fromColumns([full, [], [], [], []], { next: 2 });
  const snap = JSON.stringify(s.cols);
  const nextBefore = s.next;
  const r = Core.drop(s, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'full');
  assert.equal(JSON.stringify(s.cols), snap);
  assert.equal(s.next, nextBefore);
  assert.equal(s.score, 0);
  assert.equal(Core.canDrop(s, 0), false);
  assert.equal(Core.canDrop(s, 1), true);
  assert.equal(Core.drop(s, 9).ok, false);
  assert.equal(Core.drop(s, -1).ok, false);
});

test('6. bütün sütunlar dolunca oyun biter, sonrası hamle kabul edilmez', () => {
  // Satranç tahtası deseni: hiçbir komşu eşit olmaz, hiç birleşme yok.
  const target = (c, r) => ((c + r) % 2 === 0 ? 2 : 4);
  const seq = [];
  for (let c = 0; c < Core.COLS; c++) for (let r = 0; r < Core.ROWS; r++) seq.push([c, target(c, r)]);
  const s = Core.createGame();
  let last;
  seq.forEach(([c, v], i) => {
    s.next = v;
    assert.equal(s.over, false, `${i}. hamleden önce oyun bitmemeli`);
    last = Core.drop(s, c);
    assert.equal(last.ok, true);
    assert.equal(last.chain, 0);
  });
  assert.equal(last.over, true);
  assert.equal(s.over, true);
  assert.equal(Core.isFull(s), true);
  assert.equal(Core.drop(s, 0).ok, false);
  assert.equal(Core.drop(s, 0).reason, 'over');
});

test('6b. son hamlede birleşme olursa sütun boşalır ve oyun bitmez', () => {
  const cols = [];
  for (let c = 0; c < Core.COLS; c++) {
    cols.push(Array.from({ length: Core.ROWS }, (_, r) => ((c + r) % 2 === 0 ? 2 : 4)));
  }
  cols[4].pop(); // (4,6) boş; altı (4,5) = 4
  const s = Core.fromColumns(cols, { next: 4 });
  assert.equal(s.over, false);
  const r = Core.drop(s, 4); // 4 + 4 birleşir
  assert.equal(r.over, false);
  assert.equal(s.cols[4].length, Core.ROWS - 1);
});

test('7. yeniden başlatma temiz oyun üretir', () => {
  const s = Core.fromColumns([[2, 4], [8]], { next: 2, score: 500, won: true });
  s.over = true;
  const n = Core.createGame();
  assert.equal(n.score, 0);
  assert.equal(n.over, false);
  assert.equal(n.won, false);
  assert.ok([2, 4].includes(n.next));
  assert.deepEqual(vals(n), [[], [], [], [], []]);
});

test('9. 2048 oluşunca kazanma bir kez bildirilir, oyun devam eder', () => {
  const s = Core.fromColumns([[1024], [], [], [], []], { next: 1024 });
  const r = Core.drop(s, 1); // yatay birleşme
  assert.equal(r.won, true);
  assert.equal(s.won, true);
  assert.deepEqual(vals(s).slice(0, 2), [[], [2048]]);
  assert.equal(r.over, false);
  s.next = 2048;
  const r2 = Core.drop(s, 2);
  assert.equal(r2.won, false); // ikinci kez bildirilmez
  assert.deepEqual(vals(s)[2], [4096]);
  assert.equal(Core.drop(s, 0).ok, true); // devam edilebilir

  const t = Core.fromColumns([[1024]], { next: 1024 });
  assert.equal(Core.drop(t, 0).won, true); // dikey birleşme
});

test('10. rastgele 400 oyun: değişmezler her hamlede korunur', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const rng = mulberry32(seed);
    const s = Core.createGame({ rng });
    let dropped = 0;
    let scoreSum = 0;
    let moves = 0;
    while (!s.over) {
      const open = [0, 1, 2, 3, 4].filter((c) => Core.canDrop(s, c));
      assert.ok(open.length > 0, 'oyun bitmediyse açık sütun olmalı');
      const c = open[Math.floor(rng() * open.length)];
      const v = s.next;
      const prev = s.score;
      const r = Core.drop(s, c);
      assert.equal(r.ok, true);
      dropped += v;
      scoreSum += r.steps.filter((x) => x.type === 'merge').reduce((a, x) => a + x.points, 0);
      assert.equal(s.score, scoreSum);
      assert.equal(r.gained, s.score - prev);
      assert.equal(sum(s), dropped, 'toplam değer korunmalı');
      const ids = new Set();
      s.cols.forEach((col, ci) => {
        assert.ok(col.length <= Core.ROWS);
        col.forEach((b, ri) => {
          assert.ok(Number.isInteger(Math.log2(b.v)) && b.v >= 2, 'değer 2 üssü olmalı');
          assert.ok(!ids.has(b.id), 'kimlikler tekil olmalı');
          ids.add(b.id);
          const right = s.cols[ci + 1]?.[ri];
          const above = col[ri + 1];
          assert.ok(!(right && right.v === b.v), 'yatay eşit komşu kalmamalı');
          assert.ok(!(above && above.v === b.v), 'dikey eşit komşu kalmamalı');
        });
      });
      assert.ok([2, 4].includes(s.next));
      assert.equal(s.over, s.cols.every((col) => col.length === Core.ROWS));
      moves++;
      assert.ok(moves < 5000, 'oyun sonsuza gitmemeli');
    }
  }
});
