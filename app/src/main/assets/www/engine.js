/* KasKu engine: parsing, kategorisasi, anggaran amplop, realokasi otomatis,
   peringatan, dan ringkasan. 100% offline, tanpa dependensi. */
(function (root) {
  'use strict';

  // ---------- Konfigurasi awal ----------
  var DEFAULT_POTS = [
    { id: 'makan',    name: 'Makan',         budget: 1476000, fixed: false },
    { id: 'kas',      name: 'Kas rumah',     budget: 120000,  fixed: true  },
    { id: 'tabungan', name: 'Tabungan',      budget: 200000,  fixed: true  },
    { id: 'lain',     name: 'Laundry & lain',budget: 50000,   fixed: false },
    { id: 'motor',    name: 'Motor',         budget: 154000,  fixed: false }
  ];

  var KEYWORDS = {
    makan: ['ayam','dada','filet','paha','telur','telor','sayur','pakcoy','bayam','kangkung','sawi','brokoli',
      'kol','kubis','buncis','wortel','timun','tomat','terong','jamur','labu','tahu','tempe','ikan','nila','tongkol',
      'kembung','lele','udang','daging','sapi','pisang','pepaya','apel','jeruk','buah','minyak','bumbu','bawang',
      'cabe','cabai','garam','kecap','sambal','gas','elpiji','lpg','beras','nasi','makan','makanan','minum','air galon',
      'galon','susu','oat','gandum','kopi','teh','gula','roti','snack','jajan','lauk','warteg','kantin','bakso','mie',
      'sate','gorengan','es','jus','protein','whey'],
    motor: ['bensin','pertalite','pertamax','bbm','solar','oli','servis','service','bengkel','parkir','ban','tambal',
      'motor','aki','kampas','rantai','cuci motor','helm','pajak motor','stnk','spion'],
    kas: ['listrik','token','pln','wifi','internet','indihome','air pdam','pdam','iuran','kas','sampah','kos','kost','sewa'],
    lain: ['laundry','londri','cuci baju','sabun','deterjen','detergen','odol','pasta gigi','shampo','sampo','sikat',
      'tisu','pulsa','kuota','print','fotokopi','fotocopy','alat tulis','buku','pena','pulpen','obat','potong rambut',
      'cukur','parfum','deodoran']
  };

  var UNITS = {
    kg: { base: 'g', mul: 1000 }, kilo: { base: 'g', mul: 1000 }, kilogram: { base: 'g', mul: 1000 },
    g: { base: 'g', mul: 1 }, gr: { base: 'g', mul: 1 }, gram: { base: 'g', mul: 1 }, ons: { base: 'g', mul: 100 },
    l: { base: 'ml', mul: 1000 }, lt: { base: 'ml', mul: 1000 }, liter: { base: 'ml', mul: 1000 }, ml: { base: 'ml', mul: 1 },
    biji: { base: 'pcs', mul: 1 }, butir: { base: 'pcs', mul: 1 }, buah: { base: 'pcs', mul: 1 }, pcs: { base: 'pcs', mul: 1 },
    bks: { base: 'pcs', mul: 1 }, bungkus: { base: 'pcs', mul: 1 }, porsi: { base: 'pcs', mul: 1 }, ikat: { base: 'pcs', mul: 1 },
    papan: { base: 'pcs', mul: 1 }, kotak: { base: 'pcs', mul: 1 }, botol: { base: 'pcs', mul: 1 }, sachet: { base: 'pcs', mul: 1 },
    lembar: { base: 'pcs', mul: 1 }, x: { base: 'pcs', mul: 1 }, kali: { base: 'pcs', mul: 1 }, tabung: { base: 'pcs', mul: 1 },
    sisir: { base: 'pcs', mul: 1 }, pack: { base: 'pcs', mul: 1 }
  };

  var INCOME_WORDS = /\b(dapat|dapet|gaji|kiriman|dikirim|dikasih|terima|nerima|masuk|pemasukan|honor|bonus|transferan|uang saku|beasiswa)\b/i;
  var SAVE_WORDS = /\b(nabung|menabung|tabung|tabungan|simpan)\b/i;

  // ---------- Util ----------
  function rp(n) {
    var neg = n < 0; n = Math.round(Math.abs(n));
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−Rp' : 'Rp') + s;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function dayKey(d) { return monthKey(d) + '-' + pad(d.getDate()); }
  function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // "40k" "40rb" "40 ribu" "1,5jt" "40.000" "rp40000" -> angka
  function parseMoney(tok, suffix) {
    var t = String(tok).toLowerCase().replace(/^rp\.?/, '');
    var mul = 1;
    var sfx = (suffix || '').toLowerCase();
    if (/^(k|rb|ribu|rebu)$/.test(sfx)) mul = 1000;
    else if (/^(jt|juta)$/.test(sfx)) mul = 1000000;
    if (mul > 1) {
      t = t.replace(',', '.');
      if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
      return Math.round(parseFloat(t) * mul);
    }
    // tanpa akhiran: titik/koma sebagai pemisah ribuan
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return parseInt(t.replace(/[.,]/g, ''), 10);
    return Math.round(parseFloat(t.replace(',', '.')));
  }

  // Pecah input jadi beberapa item. Koma desimal ("1,5 kg") tidak dipecah.
  function splitItems(text) {
    return text
      .split(/\n|;|,(?=\s*[a-zA-Z])|\s+dan\s+|\s+\+\s+|\s+&\s+/i)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  // ---------- Parser satu item ----------
  function parseItem(raw) {
    var s = ' ' + raw.toLowerCase().replace(/\s+/g, ' ') + ' ';
    var price = null, qty = null, unit = null;

    // 1) harga dengan akhiran/awalan jelas
    var moneyRe = /(?:^|\s)(rp\.?\s?)?(\d+(?:[.,]\d+)*)\s?(k|rb|ribu|rebu|jt|juta)(?=\s|$)/;
    var m = s.match(moneyRe);
    if (m) {
      price = parseMoney(m[2], m[3]);
      s = s.replace(m[0], ' ');
    } else {
      var m2 = s.match(/(?:^|\s)rp\.?\s?(\d+(?:[.,]\d+)*)(?=\s|$)/);
      if (m2) { price = parseMoney(m2[1]); s = s.replace(m2[0], ' '); }
    }

    // 2) jumlah + satuan
    var unitNames = Object.keys(UNITS).sort(function (a, b) { return b.length - a.length; }).join('|');
    var qRe = new RegExp('(?:^|\\s)(\\d+(?:[.,]\\d+)?)\\s?(' + unitNames + ')(?=\\s|$)');
    var q = s.match(qRe);
    if (q) {
      qty = parseFloat(q[1].replace(',', '.'));
      unit = q[2];
      s = s.replace(q[0], ' ');
    }

    // 3) angka sisa tanpa satuan
    var nums = s.match(/(?:^|\s)(\d+(?:[.,]\d+)*)(?=\s|$)/g) || [];
    nums.forEach(function (tok) {
      var v = tok.trim();
      var val = parseMoney(v);
      if (price === null && val >= 500) { price = val; s = s.replace(tok, ' '); }
      else if (qty === null && val < 500) { qty = parseFloat(v.replace(',', '.')); unit = unit || 'pcs'; s = s.replace(tok, ' '); }
    });

    var name = s
      .replace(/\b(beli|bayar|harga|rp|seharga|total|habis|buat|untuk|isi|ngisi|tadi|barusan|dst|dll|dsb|etc)\b/g, ' ')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ').trim();

    return { name: name, qty: qty, unit: unit, price: price, raw: raw.trim() };
  }

  // ---------- Kategorisasi ----------
  function categorize(name, learned, pots) {
    var n = ' ' + name + ' ';
    var words = name.split(' ');
    // pembelajaran dari koreksi pengguna (frasa penuh dulu, lalu per kata)
    if (learned[name]) return { pot: learned[name], how: 'belajar' };
    for (var i = 0; i < words.length; i++) {
      if (learned[words[i]]) return { pot: learned[words[i]], how: 'belajar' };
    }
    var best = null, bestLen = 0;
    Object.keys(KEYWORDS).forEach(function (pot) {
      if (!pots.some(function (p) { return p.id === pot; })) return;
      KEYWORDS[pot].forEach(function (kw) {
        if (n.indexOf(' ' + kw + ' ') !== -1 || n.indexOf(' ' + kw) !== -1 && kw.length >= 4) {
          if (kw.length > bestLen) { best = pot; bestLen = kw.length; }
        }
      });
    });
    if (best) return { pot: best, how: 'kata kunci' };
    return { pot: 'lain', how: 'tebakan' };
  }

  function findPotByWord(word, pots) {
    var w = word.toLowerCase().trim();
    var alias = { makan: 'makan', makanan: 'makan', motor: 'motor', bensin: 'motor', transport: 'motor',
      kas: 'kas', rumah: 'kas', listrik: 'kas', tabungan: 'tabungan', nabung: 'tabungan',
      lain: 'lain', 'lain-lain': 'lain', laundry: 'lain', lainnya: 'lain' };
    if (alias[w]) return alias[w];
    var p = pots.filter(function (p) { return p.name.toLowerCase().indexOf(w) === 0 || p.id === w; })[0];
    return p ? p.id : null;
  }

  // ---------- State ----------
  function newState(now) {
    var s = {
      version: 1,
      settings: { income: 2000000, pots: JSON.parse(JSON.stringify(DEFAULT_POTS)) },
      months: {},
      learned: {},
      prices: {},
      chat: []
    };
    ensureMonth(s, now || new Date());
    return s;
  }

  function ensureMonth(state, now) {
    var key = monthKey(now);
    if (!state.months[key]) {
      var budgets = {};
      state.settings.pots.forEach(function (p) { budgets[p.id] = p.budget; });
      state.months[key] = { budgets: budgets, tx: [], moves: [], income: [] };
    }
    return state.months[key];
  }

  function spentByPot(month) {
    var out = {};
    Object.keys(month.budgets).forEach(function (k) { out[k] = 0; });
    month.tx.forEach(function (t) { out[t.pot] = (out[t.pot] || 0) + t.price; });
    return out;
  }

  // Berapa yang bisa "disumbangkan" sebuah pos tanpa mengganggu sisa bulan:
  // hanya bagian yang lebih hemat dari jadwal.
  function donorCapacity(budget, spent, now) {
    var dim = daysInMonth(now), day = now.getDate();
    var daysLeft = dim - day + 1;
    var reserve = budget * (daysLeft / dim);
    return Math.max(0, Math.floor((budget - spent) - reserve));
  }

  // Tutup defisit pos secara otomatis. Urutan donor: pos fleksibel dengan
  // kelebihan terbesar -> Laundry & lain -> (terakhir) Tabungan.
  function rebalance(state, month, now) {
    var notes = [];
    var pots = state.settings.pots;
    var spent = spentByPot(month);
    pots.forEach(function (p) {
      var deficit = spent[p.id] - month.budgets[p.id];
      if (deficit <= 0 || p.id === 'tabungan') return;
      var donors = pots
        .filter(function (d) { return d.id !== p.id && !d.fixed; })
        .map(function (d) { return { id: d.id, cap: donorCapacity(month.budgets[d.id], spent[d.id], now) }; })
        .sort(function (a, b) { return b.cap - a.cap; });
      donors.forEach(function (d) {
        if (deficit <= 0 || d.cap <= 0) return;
        var amt = Math.min(deficit, d.cap);
        month.budgets[d.id] -= amt; month.budgets[p.id] += amt; deficit -= amt;
        month.moves.push({ ts: now.getTime(), from: d.id, to: p.id, amount: amt, reason: 'otomatis' });
        notes.push({ level: 'info', text: 'Pos ' + potName(state, p.id) + ' jebol, aku ambil ' + rp(amt) + ' dari ' + potName(state, d.id) + '.' });
      });
      if (deficit > 0) {
        var tabLeft = month.budgets.tabungan - (spent.tabungan || 0);
        if (tabLeft > 0) {
          var amt2 = Math.min(deficit, tabLeft);
          month.budgets.tabungan -= amt2; month.budgets[p.id] += amt2; deficit -= amt2;
          month.moves.push({ ts: now.getTime(), from: 'tabungan', to: p.id, amount: amt2, reason: 'darurat' });
          notes.push({ level: 'critical', text: 'Tidak ada pos lain yang longgar. Terpaksa ambil ' + rp(amt2) + ' dari Tabungan untuk ' + potName(state, p.id) + '.' });
        }
      }
      if (deficit > 0) {
        notes.push({ level: 'critical', text: potName(state, p.id) + ' minus ' + rp(deficit) + ' dan semua pos sudah habis. Uang bulan ini tidak cukup.' });
      }
    });
    return notes;
  }

  function potName(state, id) {
    var p = state.settings.pots.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : id;
  }

  // ---------- Status, peringatan, ringkasan ----------
  function status(state, now) {
    now = now || new Date();
    var month = ensureMonth(state, now);
    var spent = spentByPot(month);
    var dim = daysInMonth(now), day = now.getDate(), daysLeft = dim - day + 1;
    var timeFrac = day / dim;
    var pots = state.settings.pots.map(function (p) {
      var b = month.budgets[p.id], s = spent[p.id] || 0;
      var left = b - s;
      var frac = b > 0 ? s / b : 0;
      var level = 'good';
      if (left < 0) level = 'critical';
      else if (!p.fixed && frac > timeFrac + 0.25) level = 'serious';
      else if (!p.fixed && frac > timeFrac + 0.12) level = 'warning';
      return { id: p.id, name: p.name, budget: b, spent: s, left: left, frac: frac,
        perDay: Math.max(0, left) / daysLeft, fixed: p.fixed, level: level };
    });
    var totalBudget = pots.reduce(function (a, p) { return a + p.budget; }, 0);
    var totalSpent = pots.reduce(function (a, p) { return a + (p.id === 'tabungan' ? 0 : p.spent); }, 0);
    var saved = spent.tabungan || 0;
    var extraIncome = month.income.reduce(function (a, i) { return a + i.amount; }, 0);
    var flexLeft = pots.filter(function (p) { return !p.fixed; }).reduce(function (a, p) { return a + Math.max(0, p.left); }, 0);

    // pengeluaran harian bulan ini
    var daily = [];
    for (var d = 1; d <= dim; d++) daily.push(0);
    month.tx.forEach(function (t) {
      if (t.pot === 'tabungan') return;
      var dt = new Date(t.ts);
      if (monthKey(dt) === monthKey(now)) daily[dt.getDate() - 1] += t.price;
    });

    return { month: monthKey(now), day: day, dim: dim, daysLeft: daysLeft, timeFrac: timeFrac,
      pots: pots, totalBudget: totalBudget, totalSpent: totalSpent, saved: saved, extraIncome: extraIncome,
      flexLeft: flexLeft, flexPerDay: flexLeft / daysLeft, daily: daily, moves: month.moves.slice(-5).reverse(),
      tx: month.tx.slice().reverse() };
  }

  function warnings(state, now) {
    var st = status(state, now);
    var out = [];
    st.pots.forEach(function (p) {
      if (p.fixed) return;
      var pct = Math.round(p.frac * 100), tpct = Math.round(st.timeFrac * 100);
      if (p.level === 'critical') out.push({ level: 'critical', text: p.name + ' sudah lewat anggaran ' + rp(-p.left) + '.' });
      else if (p.level === 'serious') out.push({ level: 'serious', text: p.name + ' terpakai ' + pct + '%, padahal bulan baru jalan ' + tpct + '%. Sisa aman ' + rp(p.perDay) + '/hari.' });
      else if (p.level === 'warning') out.push({ level: 'warning', text: p.name + ' agak cepat: ' + pct + '% terpakai di hari ke-' + st.day + '. Jaga di ' + rp(p.perDay) + '/hari.' });
    });
    return out;
  }

  function weeklySummary(state, now) {
    now = now || new Date();
    var since = now.getTime() - 7 * 86400000;
    var all = [];
    Object.keys(state.months).forEach(function (k) { all = all.concat(state.months[k].tx); });
    var week = all.filter(function (t) { return t.ts >= since && t.ts <= now.getTime() && t.pot !== 'tabungan'; });
    var total = week.reduce(function (a, t) { return a + t.price; }, 0);
    var byPot = {};
    week.forEach(function (t) { byPot[t.pot] = (byPot[t.pot] || 0) + t.price; });
    var byItem = {};
    week.forEach(function (t) { byItem[t.name] = (byItem[t.name] || 0) + t.price; });
    var top = Object.keys(byItem).sort(function (a, b) { return byItem[b] - byItem[a]; }).slice(0, 3);
    var st = status(state, now);
    var weeklyBudget = st.pots.filter(function (p) { return !p.fixed; })
      .reduce(function (a, p) { return a + p.budget; }, 0) * 7 / st.dim;
    var lines = [];
    lines.push('Ringkasan 7 hari terakhir: total keluar ' + rp(total) + ' dari jatah mingguan ' + rp(weeklyBudget) + '.');
    if (total > weeklyBudget * 1.1) lines.push('Minggu ini lebih boros ' + rp(total - weeklyBudget) + ' dari jatah.');
    else if (total < weeklyBudget * 0.9 && total > 0) lines.push('Minggu ini hemat ' + rp(weeklyBudget - total) + '. Mantap.');
    Object.keys(byPot).forEach(function (k) { lines.push('• ' + potName(state, k) + ': ' + rp(byPot[k])); });
    if (top.length) lines.push('Paling banyak: ' + top.map(function (n) { return cap(n) + ' (' + rp(byItem[n]) + ')'; }).join(', ') + '.');
    if (!week.length) lines.push('Belum ada catatan minggu ini.');
    warnings(state, now).forEach(function (w) { lines.push('⚠ ' + w.text); });
    return lines.join('\n');
  }

  // Bandingkan harga per satuan dengan pembelian sebelumnya
  function priceNote(state, item) {
    if (!item.qty || !item.unit || !UNITS[item.unit] || !item.price) return null;
    var u = UNITS[item.unit];
    var baseQty = item.qty * u.mul;
    if (!baseQty) return null;
    var per = item.price / baseQty;
    var key = item.name + '|' + u.base;
    var prev = state.prices[key];
    state.prices[key] = per;
    if (!prev) return null;
    var change = (per - prev) / prev;
    var unitLabel = u.base === 'g' ? 'kg' : (u.base === 'ml' ? 'liter' : 'biji');
    var mul = u.base === 'pcs' ? 1 : 1000;
    if (change > 0.1) return 'Harga ' + item.name + ' naik ' + Math.round(change * 100) + '% (' + rp(prev * mul) + ' → ' + rp(per * mul) + ' per ' + unitLabel + ').';
    if (change < -0.1) return 'Harga ' + item.name + ' lebih murah ' + Math.round(-change * 100) + '% dari sebelumnya.';
    return null;
  }

  // ---------- Pemroses pesan ----------
  function handle(state, text, now) {
    now = now || new Date();
    var month = ensureMonth(state, now);
    var t = text.trim();
    var low = t.toLowerCase();
    var reply = [];

    if (!t) return { reply: '', added: [] };

    if (/^(batal|undo|hapus( yang)? terakhir|salah)$/.test(low)) {
      var last = month.tx.pop();
      if (!last) return { reply: 'Belum ada catatan bulan ini yang bisa dibatalkan.', added: [] };
      return { reply: 'Dibatalkan: ' + cap(last.name) + ' ' + rp(last.price) + '.', added: [] };
    }
    if (/^(ringkasan|rangkuman|laporan|summary)/.test(low)) return { reply: weeklySummary(state, now), added: [] };
    if (/^(sisa|status|cek)/.test(low)) {
      var st = status(state, now);
      var lines = ['Sisa per pos (hari ke-' + st.day + ' dari ' + st.dim + '):'];
      st.pots.forEach(function (p) {
        if (p.id === 'tabungan') lines.push('• Tabungan: terkumpul ' + rp(p.spent) + ' dari target ' + rp(p.budget));
        else lines.push('• ' + p.name + ': ' + rp(p.left) + (p.fixed ? '' : ' (' + rp(p.perDay) + '/hari)'));
      });
      return { reply: lines.join('\n'), added: [] };
    }
    var mv = low.match(/^(?:ganti|pindah|ubah|masukin|masukkan)\s*(?:yang\s+)?(?:terakhir\s*)?(?:ke|jadi|ke pos)\s+([a-z-]+)/);
    if (mv) {
      var target = findPotByWord(mv[1], state.settings.pots);
      var lt = month.tx[month.tx.length - 1];
      if (!target) return { reply: 'Pos "' + mv[1] + '" tidak ada. Pilihan: Makan, Kas, Tabungan, Lain, Motor.', added: [] };
      if (!lt) return { reply: 'Belum ada catatan untuk dipindah.', added: [] };
      lt.pot = target;
      state.learned[lt.name] = target;
      var notes0 = rebalance(state, month, now);
      return { reply: cap(lt.name) + ' dipindah ke ' + potName(state, target) + '. Ke depan aku ingat.' + notesText(notes0), added: [] };
    }

    var parts = splitItems(t);
    var added = [];
    parts.forEach(function (part) {
      var it = parseItem(part);
      if (it.price === null || isNaN(it.price)) {
        reply.push('“' + part + '” belum ada harganya. Contoh: ayam 1 kg 40k');
        return;
      }
      if (INCOME_WORDS.test(part) && !SAVE_WORDS.test(part)) {
        month.income.push({ ts: now.getTime(), amount: it.price, name: it.name || 'pemasukan' });
        // pemasukan ekstra masuk ke Tabungan supaya tidak "hilang"
        month.budgets.tabungan += it.price;
        reply.push('+ Pemasukan ' + rp(it.price) + ' (' + (it.name || 'lainnya') + '). Target tabungan bulan ini naik jadi ' + rp(month.budgets.tabungan) + '.');
        return;
      }
      var cat = SAVE_WORDS.test(part) ? { pot: 'tabungan', how: 'kata kunci' } : categorize(it.name || part.toLowerCase(), state.learned, state.settings.pots);
      var tx = { id: uid(), ts: now.getTime(), name: it.name || 'tanpa nama', qty: it.qty, unit: it.unit,
        price: it.price, pot: cat.pot, how: cat.how, raw: it.raw };
      month.tx.push(tx);
      added.push(tx);
      var q = it.qty ? ' ' + String(it.qty).replace('.', ',') + ' ' + (it.unit || '') : '';
      reply.push('✓ ' + cap(tx.name) + q.replace(/\s+$/, '') + ', ' + rp(tx.price) + ' → ' + potName(state, tx.pot) +
        (cat.how === 'tebakan' ? ' (tebakan; ketik "ganti ke makan" kalau salah)' : ''));
      var pn = priceNote(state, it);
      if (pn) reply.push('ℹ ' + pn);
    });

    if (added.length) {
      var notes = rebalance(state, month, now);
      var st2 = status(state, now);
      var touched = {};
      added.forEach(function (a) { touched[a.pot] = true; });
      Object.keys(touched).forEach(function (pid) {
        var p = st2.pots.filter(function (x) { return x.id === pid; })[0];
        if (!p) return;
        if (pid === 'tabungan') { reply.push('Tabungan terkumpul ' + rp(p.spent) + ' dari target ' + rp(p.budget) + '.'); return; }
        reply.push('Sisa ' + p.name + ': ' + rp(p.left) + (p.fixed ? '' : ' (' + rp(p.perDay) + '/hari sampai akhir bulan)'));
      });
      var txt = notesText(notes);
      if (txt) reply.push(txt.trim());
      warnings(state, now).filter(function (w) { return touched[findPotByName(state, w.text)]; })
        .forEach(function (w) { reply.push('⚠ ' + w.text); });
    }
    return { reply: reply.join('\n'), added: added };
  }

  function findPotByName(state, text) {
    var p = state.settings.pots.filter(function (x) { return text.indexOf(x.name) === 0; })[0];
    return p ? p.id : null;
  }
  function notesText(notes) {
    return notes.length ? '\n' + notes.map(function (n) { return (n.level === 'critical' ? '⛔ ' : '↻ ') + n.text; }).join('\n') : '';
  }

  var api = { newState: newState, ensureMonth: ensureMonth, handle: handle, status: status, warnings: warnings,
    weeklySummary: weeklySummary, parseItem: parseItem, splitItems: splitItems, parseMoney: parseMoney,
    categorize: categorize, rp: rp, monthKey: monthKey, dayKey: dayKey, DEFAULT_POTS: DEFAULT_POTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KasKu = api;
})(this);
