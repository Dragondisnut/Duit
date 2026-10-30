/* KasKu Gizi: catat makanan per gram/butir, hitung kalori & zat gizi, target harian.
   100% offline. Data gizi dari gizi_db.js (TKPI + USDA). */
(function (root) {
  'use strict';

  var NUTR = ['kkal', 'p', 'l', 'k', 's'];
  var LABEL = { kkal: 'Kalori', p: 'Protein', l: 'Lemak', k: 'Karbohidrat', s: 'Serat' };

  // satuan → gram (atau penanda khusus)
  var UNITS = {
    g: 1, gr: 1, gram: 1, grm: 1, kg: 1000, kilo: 1000, ons: 100,
    butir: 'butir', biji: 'butir', btr: 'butir', buah: 'butir', pcs: 'butir', telur: 'butir',
    sdm: 'sdm', 'sendok makan': 'sdm', sendok: 'sdm',
    ml: 'ml', l: 'l', liter: 'l', lt: 'l', lembar: 'lembar', slice: 'lembar', iris: 'lembar'
  };
  var COOK = /\b(rebus|direbus|kukus|dikukus|goreng|digoreng|panggang|dipanggang|bakar|dibakar|tumis|ditumis|ceplok|dadar|orak arik|orak-arik|mentah|segar|matang|potong)\b/g;
  var OILY = /\b(goreng|digoreng|tumis|ditumis|ceplok|dadar|orak arik|orak-arik)\b/;
  // gram per butir bawaan: USDA FoodData Central SR Legacy, telur utuh ukuran "large" tanpa kulit = 50 g;
  // putih telur "large" = 33 g. Bisa diubah di pengaturan.
  var BUTIR_DEFAULT = 50;
  var RASIO_PUTIH = 33 / 50;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function fmt(x) { return String(r1(x)).replace('.', ','); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim(); }

  function ensure(state) {
    if (!state.gizi) state.gizi = {};
    var g = state.gizi;
    g.target = g.target || null;
    g.profil = g.profil || null;
    g.butir = g.butir || BUTIR_DEFAULT;
    g.custom = g.custom || {};
    g.log = g.log || {};
    return g;
  }

  // ---------- pencarian bahan ----------
  var _idx = null;
  function dbDasar() { return root.GIZI_DB || (typeof GIZI_DB !== 'undefined' ? GIZI_DB : []); }
  function indeks() {
    if (_idx) return _idx;
    _idx = dbDasar().map(function (it) {
      return { it: it, nama: norm(it.n), kata: norm(it.n).split(' '), alias: (it.a || []).map(norm) };
    });
    return _idx;
  }
  function daftar(state) {
    var g = ensure(state), cs = Object.keys(g.custom).map(function (k) {
      var c = g.custom[k], it = { k: 'c:' + k, n: c.n, a: [k], g: c.g, src: 'Isian sendiri', custom: 1, kur: 1 };
      return { it: it, nama: norm(c.n), kata: norm(c.n).split(' '), alias: [norm(k)] };
    });
    return cs.concat(indeks());
  }
  function semuaKata(q, kata) {
    // setiap kata di q harus cocok (awal kata) dengan salah satu kata nama
    return q.split(' ').every(function (w) { return kata.some(function (k) { return k.indexOf(w) === 0; }); });
  }
  function skor(x) {
    var s = 0, n = x.nama;
    if (x.it.kur) s += 50;
    if (/\b(mentah|segar)\b/.test(n)) s += 20;
    if (x.it.m) s -= 10;
    return s - n.length / 10;
  }

  // Urutan: kode (t373/u171077) → isian sendiri → nama persis → alias kurasi persis →
  // alias kurasi yang terkandung vs. bahan yang namanya memuat semua kata (yang lebih spesifik menang).
  // Kata cara masak (rebus, goreng, ...) sudah dibuang sebelum pencarian: berat dicatat mentah.
  function cari(state, nama) {
    var q = norm(nama);
    if (!q) return null;
    var L = daftar(state), i, x, nq = q.split(' ').length;
    if (/^[tu]\d+$/.test(q)) {
      for (i = 0; i < L.length; i++) if (L[i].it.k === q) return { it: L[i].it, alt: 0 };
      return null;
    }
    for (i = 0; i < L.length; i++) { x = L[i]; if (x.it.custom && x.alias.indexOf(q) >= 0) return { it: x.it, alt: 0 }; }
    for (i = 0; i < L.length; i++) { x = L[i]; if (x.nama === q) return { it: x.it, alt: 0 }; }
    for (i = 0; i < L.length; i++) { x = L[i]; if (x.alias.indexOf(q) >= 0) return { it: x.it, alt: 0 }; }
    var A = null, aLen = 0;
    L.forEach(function (x) {
      x.alias.forEach(function (a) {
        if (a.length > aLen && (' ' + q + ' ').indexOf(' ' + a + ' ') >= 0) { A = x; aLen = a.length; A._kata = a.split(' ').length; }
      });
    });
    var C = L.filter(function (x) { return semuaKata(q, x.kata); }).sort(function (a, b) { return skor(b) - skor(a); });
    if (A && C.length && C[0] !== A && A._kata < nq) return { it: C[0].it, alt: C.length - 1 };
    if (A) return { it: A.it, alt: 0 };
    if (C.length) return { it: C[0].it, alt: C.length - 1 };
    return null;
  }

  function cariBanyak(state, q, maks) {
    q = norm(q);
    if (!q) return [];
    return daftar(state).filter(function (x) { return semuaKata(q, x.kata) || x.alias.some(function (a) { return a.indexOf(q) === 0; }); })
      .sort(function (a, b) { return skor(b) - skor(a); }).slice(0, maks || 10).map(function (x) { return x.it; });
  }

  // ---------- parser ----------
  function splitItems(text) {
    return text.split(/\n|;|,(?=\s*[a-zA-Z])|\s+dan\s+|\s+\+\s+|\s+&\s+/i)
      .map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function parseLine(raw) {
    var s = ' ' + raw.toLowerCase().replace(/\s+/g, ' ') + ' ';
    var qty = null, unit = null;
    var names = Object.keys(UNITS).sort(function (a, b) { return b.length - a.length; })
      .map(function (u) { return u.replace(' ', '\\s'); }).join('|');
    var m = s.match(new RegExp('(?:^|\\s)(\\d+(?:[.,]\\d+)?)\\s?(' + names + ')(?=\\s|$)'));
    if (m) {
      qty = parseFloat(m[1].replace(',', '.'));
      unit = m[2].replace(/\s+/g, ' ');
      // "2 telur" → angka + nama, jangan hapus kata "telur"
      s = unit === 'telur' ? s.replace(m[0], ' telur ') : s.replace(m[0], ' ');
    } else {
      var n = s.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/);
      if (n) { qty = parseFloat(n[1].replace(',', '.')); s = s.replace(n[0], ' '); }
    }
    var masak = (s.match(COOK) || []).join(' ');
    var name = s.replace(COOK, ' ').replace(/\b(makan|tadi|barusan|sarapan|siang|malam|pagi|snack|dst|dll|dsb)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return { name: name, qty: qty, unit: unit, masak: masak, oily: OILY.test(s), raw: raw.trim() };
  }

  function keGram(state, it, p) {
    var g = ensure(state);
    if (p.qty === null || isNaN(p.qty)) return { err: 'jumlahnya berapa? Contoh: ' + it.n.toLowerCase() + ' 100g' };
    var u = p.unit ? UNITS[p.unit] : null;
    if (typeof u === 'number') return { gram: p.qty * u };
    if (u === 'butir' || (!p.unit && (it.butir || it.putih))) {
      if (it.butir) return { gram: p.qty * g.butir, ket: p.qty + ' butir × ' + fmt(g.butir) + ' g' };
      if (it.putih) { var w = g.butir * RASIO_PUTIH; return { gram: p.qty * w, ket: p.qty + ' butir × ' + fmt(w) + ' g' }; }
      return { err: 'hitungan per butir hanya untuk telur ayam ras dan putih telur; tulis dalam gram, mis. ' + (p.name || it.n.toLowerCase()) + ' 60g' };
    }
    if (u === 'sdm') {
      if (it.sdm) return { gram: p.qty * it.sdm, ket: p.qty + ' sdm × ' + fmt(it.sdm) + ' g' };
      return { err: 'belum ada berat per sdm untuk ' + it.n.toLowerCase() + ' (baru: minyak, gula, madu, kecap, selai kacang, susu kental manis); tulis dalam gram' };
    }
    if (u === 'lembar') {
      if (it.lembar) return { gram: p.qty * it.lembar, ket: p.qty + ' lembar × ' + fmt(it.lembar) + ' g' };
      return { err: 'belum ada berat per lembar untuk ' + it.n.toLowerCase() + '; tulis dalam gram' };
    }
    if (u === 'ml' || u === 'l') {
      var ml = p.qty * (u === 'l' ? 1000 : 1);
      if (it.ml) return { gram: ml * it.ml, ket: fmt(ml) + ' ml' };
      return { err: 'satuan ml hanya untuk minuman/cairan (susu, kopi, teh, santan, minyak); untuk ' + it.n.toLowerCase() + ' tulis dalam gram' };
    }
    if (!p.unit) return { err: 'satuannya apa? Tulis dalam gram, mis. ' + (p.name || it.n.toLowerCase()) + ' 100g' };
    return { err: 'satuan "' + p.unit + '" belum dikenal' };
  }

  function hitung(it, gram) {
    var f = gram / 100, out = {}, kosong = [];
    NUTR.forEach(function (n, i) {
      var v = it.g[i];
      if (v === null || v === undefined) { out[n] = 0; kosong.push(LABEL[n].toLowerCase()); }
      else out[n] = v * f;
    });
    return { nilai: out, kosong: kosong };
  }

  // definisi bahan baru: "nama = 120 kkal, 10p, 5l, 3k, 1s"  atau  "nama = 120/10/5/3/1"
  function parseDefinisi(text) {
    var m = text.match(/^\s*([^=:]+?)\s*[=:]\s*(.+)$/);
    if (!m) return null;
    var nama = norm(m[1]), rest = m[2].toLowerCase();
    var nums = (rest.match(/\d+(?:[.,]\d+)?/g) || []).map(function (x) { return parseFloat(x.replace(',', '.')); });
    if (nums.length < 4) return null;
    var tag = function (re) { var r = rest.match(re); return r ? parseFloat(r[1].replace(',', '.')) : null; };
    var kk = tag(/(\d+(?:[.,]\d+)?)\s*(?:kkal|kcal|kal)/), pp = tag(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:p|protein)\b/),
        ll = tag(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:l|lemak|fat)\b/), kh = tag(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:k|kh|karbo|karbohidrat)\b/),
        ss = tag(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:s|serat)\b/);
    var g = (kk !== null && pp !== null && ll !== null && kh !== null)
      ? [kk, pp, ll, kh, ss === null ? 0 : ss]
      : [nums[0], nums[1], nums[2], nums[3], nums.length > 4 ? nums[4] : 0];
    return { nama: nama, g: g };
  }

  // ---------- total ----------
  function totalHari(state, key) {
    var t = { kkal: 0, p: 0, l: 0, k: 0, s: 0 };
    (ensure(state).log[key] || []).forEach(function (e) { NUTR.forEach(function (n) { t[n] += e.v[n] || 0; }); });
    return t;
  }

  function ringkas(state, key) {
    var g = ensure(state), t = totalHari(state, key), tg = g.target;
    var out = { total: t, target: tg, entri: (g.log[key] || []).slice() };
    if (tg) {
      out.sisa = tg.kkal - t.kkal;
      out.persen = {};
      NUTR.forEach(function (n) { out.persen[n] = tg[n] ? t[n] / tg[n] * 100 : 0; });
    }
    var energi = t.p * 4 + t.l * 9 + t.k * 4;
    out.komposisi = energi > 0 ? { p: t.p * 4 / energi * 100, l: t.l * 9 / energi * 100, k: t.k * 4 / energi * 100 } : null;
    return out;
  }

  function teksSisa(state, key) {
    var r = ringkas(state, key), t = r.total;
    if (!r.target) return 'Total hari ini: ' + Math.round(t.kkal) + ' kkal · P ' + fmt(t.p) + ' g · L ' + fmt(t.l) + ' g · K ' + fmt(t.k) + ' g · serat ' + fmt(t.s) + ' g. Target belum diatur.';
    var s = r.sisa >= 0 ? 'Sisa ' + Math.round(r.sisa) + ' kkal' : 'Lebih ' + Math.round(-r.sisa) + ' kkal dari target';
    return s + ' · protein ' + fmt(t.p) + '/' + r.target.p + ' g · lemak ' + fmt(t.l) + '/' + r.target.l + ' g · karbo ' + fmt(t.k) + '/' + r.target.k + ' g · serat ' + fmt(t.s) + '/' + r.target.s + ' g';
  }

  // ---------- perintah utama ----------
  function handle(state, text, now) {
    var g = ensure(state), key = dayKey(now), low = norm(text);
    if (!low) return { reply: '' };
    if (/^(batal|undo|hapus terakhir)$/.test(low)) {
      var l = g.log[key] || [];
      if (!l.length) return { reply: 'Belum ada catatan makan hari ini.' };
      var e = l.pop();
      return { reply: 'Dibatalkan: ' + e.label + ' (' + Math.round(e.v.kkal) + ' kkal).\n' + teksSisa(state, key) };
    }
    if (/^(sisa|total|ringkasan|cek)$/.test(low)) return { reply: teksSisa(state, key) };
    var mc = low.match(/^(cari|daftar|list)\s+(.+)$/);
    if (mc) {
      var hs = cariBanyak(state, mc[2], 30);
      if (!hs.length) return { reply: 'Tidak ada bahan yang cocok dengan "' + mc[2] + '". Tambahkan sendiri: ' + mc[2] + ' = kkal, protein, lemak, karbo, serat per 100 g.' };
      return { hasil: hs, q: mc[2], reply: 'Hasil "' + mc[2] + '" (per 100 g). Ketik kodenya + berat untuk memilih, mis. "' + hs[0].k + ' 100g":\n' +
        hs.map(function (it) { return it.k + ' · ' + it.n + (it.m ? ' [siap makan]' : '') + ' — ' + Math.round(it.g[0]) + ' kkal, P ' + fmt(it.g[1] || 0); }).join('\n') };
    }

    var def = parseDefinisi(text);
    if (def) {
      g.custom[def.nama] = { n: cap(def.nama), g: def.g };
      return { reply: 'Disimpan: ' + cap(def.nama) + ' per 100 g = ' + def.g[0] + ' kkal, P ' + def.g[1] + ' g, L ' + def.g[2] + ' g, K ' + def.g[3] + ' g, serat ' + def.g[4] + ' g. Sekarang bisa dicatat, mis. "' + def.nama + ' 100g".' };
    }

    var parts = splitItems(text), added = [], errs = [], notes = [], minyakNote = false;
    parts.forEach(function (part) {
      var p = parseLine(part);
      var hit = cari(state, p.name), it = hit && hit.it;
      if (!it) {
        errs.push('“' + (p.name || part) + '” belum ada di daftar. Ketik sekali: ' + (p.name || 'nama') + ' = kkal, protein, lemak, karbo, serat per 100 g (contoh: ' + (p.name || 'nama') + ' = 120 kkal, 10p, 5l, 3k, 1s)');
        return;
      }
      var gr = keGram(state, it, p);
      if (gr.err) { errs.push(cap(p.name || it.n) + ': ' + gr.err); return; }
      var h = hitung(it, gr.gram);
      var label = it.n + (p.masak ? ' (' + p.masak + ')' : '');
      var e = { id: uid(), ts: now.getTime(), k: it.k, label: label, gram: gr.gram, ket: gr.ket || '', v: h.nilai, raw: p.raw };
      (g.log[key] = g.log[key] || []).push(e);
      added.push(e);
      if (h.kosong.length) notes.push(it.n + ': data ' + h.kosong.join(', ') + ' tidak tersedia di sumber, dihitung 0.');
      if (p.oily && !it.minyak) minyakNote = true;
      e.alt = hit.alt; e.q = p.name;
      if (it.m) e.matang = 1;
    });
    var reply = [];
    if (added.length) {
      added.forEach(function (e) {
        reply.push('✓ ' + e.label + ' ' + fmt(e.gram) + ' g' + (e.ket ? ' [' + e.ket + ']' : '') + ' → ' + Math.round(e.v.kkal) + ' kkal, P ' + fmt(e.v.p) + ' g' +
          (e.matang ? ' (data siap makan: timbang dalam bentuk siap makan)' : '') + (e.alt ? ' · ada ' + e.alt + ' pilihan lain, ketik "cari ' + e.q + '"' : ''));
      });
      reply.push(teksSisa(state, key));
    }
    if (minyakNote) reply.push('Catatan: minyak untuk menggoreng/menumis belum terhitung. Catat terpisah, mis. "minyak 1 sdm".');
    notes.forEach(function (n) { reply.push('ℹ ' + n); });
    errs.forEach(function (e) { reply.push('? ' + e); });
    return { reply: reply.join('\n'), added: added.length };
  }

  function hapus(state, key, id) {
    var l = ensure(state).log[key] || [];
    var i = l.findIndex(function (e) { return e.id === id; });
    return i >= 0 ? l.splice(i, 1)[0] : null;
  }

  // ---------- kalkulator target (Mifflin-St Jeor) ----------
  var AKTIVITAS = [
    { f: 1.2, n: 'Sangat ringan (duduk, hampir tanpa olahraga)' },
    { f: 1.375, n: 'Ringan (olahraga 1–3x/minggu)' },
    { f: 1.55, n: 'Sedang (olahraga 3–5x/minggu)' },
    { f: 1.725, n: 'Berat (olahraga 6–7x/minggu)' },
    { f: 1.9, n: 'Sangat berat (fisik berat + latihan)' }
  ];
  function hitungTarget(p) {
    var bmr = 10 * p.bb + 6.25 * p.tb - 5 * p.umur + (p.jk === 'P' ? -161 : 5);
    var tdee = bmr * p.aktivitas;
    var kkal = Math.round(tdee - p.defisit);
    var prot = Math.round(p.protein_per_kg * p.bb);
    var lemak = Math.round(kkal * p.lemak_persen / 100 / 9);
    var karbo = Math.max(0, Math.round((kkal - prot * 4 - lemak * 9) / 4));
    var serat = Math.round(kkal / 1000 * 14);
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), target: { kkal: kkal, p: prot, l: lemak, k: karbo, s: serat } };
  }

  var api = { ensure: ensure, handle: handle, ringkas: ringkas, hapus: hapus, cari: cari, cariBanyak: cariBanyak, parseLine: parseLine,
    parseDefinisi: parseDefinisi, hitungTarget: hitungTarget, AKTIVITAS: AKTIVITAS, dayKey: dayKey, LABEL: LABEL,
    NUTR: NUTR, fmt: fmt, BUTIR_DEFAULT: BUTIR_DEFAULT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KasKuGizi = api;
})(this);
