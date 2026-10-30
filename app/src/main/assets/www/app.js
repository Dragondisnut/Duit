(function () {
  'use strict';
  var K = window.KasKu;
  var G = window.KasKuGizi;
  var gOffset = 0; // 0 = hari ini, -1 = kemarin, dst.
  var NATIVE = window.KasKuNative || null;
  var KEY = 'kasku_state_v1';
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var STATUS = {
    good: { c: 'var(--good)', label: 'Aman' },
    warning: { c: 'var(--warning)', label: 'Agak cepat' },
    serious: { c: 'var(--serious)', label: 'Boros' },
    critical: { c: 'var(--critical)', label: 'Lewat' }
  };
  var $ = function (id) { return document.getElementById(id); };
  var state;

  // ---------- Penyimpanan lokal ----------
  function load() {
    var raw = null;
    try { if (NATIVE && NATIVE.loadState) raw = NATIVE.loadState(); } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(KEY); } catch (e) {} }
    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    return K.newState(new Date());
  }
  function save() {
    var raw = JSON.stringify(state);
    try { localStorage.setItem(KEY, raw); } catch (e) {}
    try { if (NATIVE && NATIVE.saveState) NATIVE.saveState(raw); } catch (e) {}
  }

  // ---------- Util tampilan ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function short(n) {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + 'jt';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + 'rb';
    return String(Math.round(n));
  }
  function hhmm(ts) { var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function dmy(ts) { var d = new Date(ts); return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3); }
  var ICON = {
    warn: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22L12 2Zm1 15h-2v2h2v-2Zm0-7h-2v5h2v-5Z"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" transform="translate(1.4 0)"/></svg>'
  };

  // ---------- Render ----------
  function render() {
    var now = new Date();
    K.ensureMonth(state, now);
    var st = K.status(state, now);
    $('periode').textContent = BULAN[now.getMonth()] + ' ' + now.getFullYear() + ' · hari ke-' + st.day + ' dari ' + st.dim;

    var left = st.flexLeft;
    var fixedLeft = st.pots.filter(function (p) { return p.fixed && p.id !== 'tabungan'; }).reduce(function (a, p) { return a + Math.max(0, p.left); }, 0);
    $('heroLeft').textContent = K.rp(left);
    $('heroLeft').classList.toggle('neg', left <= 0);
    $('heroPerDay').textContent = K.rp(st.flexPerDay);
    $('heroDays').textContent = st.daysLeft;
    var tab = st.pots.filter(function (p) { return p.id === 'tabungan'; })[0];
    $('saveGot').textContent = K.rp(tab ? tab.spent : 0);
    $('saveTarget').textContent = K.rp(tab ? tab.budget : 0);
    $('saveRing').style.setProperty('--p', tab && tab.budget ? Math.min(100, tab.spent / tab.budget * 100) : 0);
    $('heroLeft').title = 'Belum termasuk kas rumah ' + K.rp(fixedLeft);

    // peringatan
    var warns = K.warnings(state, now);
    $('alerts').innerHTML = warns.map(function (w) {
      var s = STATUS[w.level];
      return '<div class="alert" style="--c:' + s.c + '">' + ICON.warn + '<div><span class="tag">' + s.label + '</span>' + esc(w.text) + '</div></div>';
    }).join('');

    // pos
    $('pots').innerHTML = st.pots.map(function (p) {
      var s = STATUS[p.level];
      var pct = p.budget > 0 ? Math.min(100, p.spent / p.budget * 100) : 0;
      var fill = p.level === 'good' ? 'var(--accent)' : s.c;
      if (p.id === 'tabungan') fill = 'var(--good)';
      var right = p.id === 'tabungan' ? K.rp(p.spent) + ' terkumpul' : 'sisa ' + K.rp(p.left);
      var sub = p.id === 'tabungan' ? 'target ' + K.rp(p.budget)
        : (p.fixed ? 'terpakai ' + K.rp(p.spent) + ' dari ' + K.rp(p.budget) : K.rp(p.perDay) + '/hari · dari ' + K.rp(p.budget));
      var badge = (!p.fixed && p.level !== 'good') ? '<span class="status" style="--c:' + s.c + '">' + s.label + '</span>' : '';
      return '<div class="pot">' +
        '<div class="pot-top"><span class="pot-name">' + esc(p.name) + ' ' + badge + '</span><span class="pot-left' + (p.left < 0 ? ' neg' : '') + '">' + right + '</span></div>' +
        '<div class="bar" role="progressbar" aria-label="' + esc(p.name) + '" aria-valuenow="' + Math.round(pct) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%;--fill:' + fill + '"></i>' +
        (p.fixed ? '' : '<b style="left:calc(' + (st.timeFrac * 100) + '% - 1px)"></b>') + '</div>' +
        '<div class="pot-sub"><span>' + sub + '</span><span>' + Math.round(pct) + '%</span></div></div>';
    }).join('');

    renderChart(st);

    // realokasi
    var month = state.months[st.month];
    $('movesCard').hidden = !month.moves.length;
    $('moves').innerHTML = month.moves.slice(-5).reverse().map(function (m) {
      return '<div class="row"><div class="main"><div class="t">' + esc(potName(m.from)) + ' → ' + esc(potName(m.to)) + '</div><div class="m">' + dmy(m.ts) + ' · ' + (m.reason === 'darurat' ? 'darurat, dari tabungan' : 'otomatis') + '</div></div><div class="v">' + K.rp(m.amount) + '</div></div>';
    }).join('');

    // transaksi
    $('txCount').textContent = st.tx.length ? st.tx.length + ' catatan bulan ini' : '';
    $('txList').innerHTML = st.tx.length ? st.tx.slice(0, 30).map(function (t) {
      var q = t.qty ? ' · ' + String(t.qty).replace('.', ',') + ' ' + (t.unit || '') : '';
      return '<div class="row"><div class="main"><div class="t">' + esc(cap(t.name)) + '</div><div class="m">' + dmy(t.ts) + ' ' + hhmm(t.ts) + q + '</div></div>' +
        '<span class="chip">' + esc(potName(t.pot)) + '</span><div class="v">' + K.rp(t.price) + '</div>' +
        '<button class="del" data-del="' + t.id + '" aria-label="Hapus ' + esc(t.name) + '">' + ICON.x + '</button></div>';
    }).join('') : '<div class="empty">Belum ada catatan. Ketik di bawah, misalnya: ayam 1 kg 40k</div>';
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function potName(id) { var p = state.settings.pots.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; }

  function renderChart(st) {
    var svg = $('chart');
    var W = svg.clientWidth || 340, H = 170, padL = 34, padR = 6, padT = 10, padB = 22;
    var iw = W - padL - padR, ih = H - padT - padB;
    var flexBudget = st.pots.filter(function (p) { return !p.fixed; }).reduce(function (a, p) { return a + p.budget; }, 0);
    var pace = flexBudget / st.dim;
    var max = Math.max(pace * 1.4, Math.max.apply(null, st.daily) * 1.1, 1000);
    var step = niceStep(max / 3);
    max = Math.ceil(max / step) * step;
    var bw = iw / st.dim;
    var y = function (v) { return padT + ih - (v / max) * ih; };
    var out = '';
    for (var g = 0; g <= max + 1; g += step) {
      out += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(g) + '" y2="' + y(g) + '"/>';
      out += '<text x="' + (padL - 6) + '" y="' + (y(g) + 3) + '" text-anchor="end">' + short(g) + '</text>';
    }
    st.daily.forEach(function (v, i) {
      var x = padL + i * bw + 1, w = Math.max(2, bw - 2);
      var future = i + 1 > st.day;
      if (v > 0) {
        var top = y(v), base = padT + ih, r = Math.min(4, w / 2, base - top);
        out += '<path class="b' + (i + 1 === st.day ? ' active' : '') + '" d="M' + x + ',' + base + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top +
          'H' + (x + w - r) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) + 'V' + base + 'Z"/>';
      } else if (future) {
        out += '<rect class="b future" x="' + x + '" y="' + (padT + ih - 2) + '" width="' + w + '" height="2"/>';
      }
      out += '<rect class="hit" data-i="' + i + '" x="' + (padL + i * bw) + '" y="' + padT + '" width="' + bw + '" height="' + ih + '"/>';
      if ((i + 1) % 5 === 0 || i === 0) out += '<text x="' + (padL + i * bw + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + (i + 1) + '</text>';
    });
    out += '<line class="axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '"/>';
    out += '<line class="pace" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(pace) + '" y2="' + y(pace) + '"/>';
    out += '<text x="' + (W - padR) + '" y="' + (y(pace) - 4) + '" text-anchor="end">jatah ' + short(pace) + '/hari</text>';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = out;

    var spentDays = st.daily.slice(0, st.day);
    var avg = spentDays.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, st.day);
    $('avgDay').textContent = 'rata-rata ' + K.rp(avg) + '/hari';
    $('dailyTable').innerHTML = '<table>' + st.daily.slice(0, st.day).map(function (v, i) {
      return '<tr><td>Tanggal ' + (i + 1) + '</td><td>' + K.rp(v) + '</td></tr>';
    }).reverse().join('') + '</table>';

    svg.onclick = svg.onpointermove = function (e) {
      var tgt = e.target.closest ? e.target.closest('.hit') : null;
      var tip = $('tip');
      svg.querySelectorAll('.b.active').forEach(function (n) { if (n.dataset.today !== '1') n.classList.remove('active'); });
      if (!tgt) { tip.hidden = true; return; }
      var i = +tgt.dataset.i;
      var rect = svg.getBoundingClientRect();
      tip.hidden = false;
      tip.textContent = (i + 1) + ' ' + BULAN[new Date().getMonth()].slice(0, 3) + ': ' + K.rp(st.daily[i]);
      tip.style.left = ((padL + i * bw + bw / 2) / W * rect.width) + 'px';
    };
    svg.onpointerleave = function () { $('tip').hidden = true; };
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  // ---------- Chat ----------
  function addMsg(who, text) {
    state.chat.push({ who: who, text: text, ts: Date.now() });
    if (state.chat.length > 300) state.chat = state.chat.slice(-300);
  }
  function renderChat() {
    var box = $('chat');
    if (!state.chat.length) {
      box.innerHTML = '<div class="msg bot">Halo! Cukup ketik apa yang kamu beli, berapa banyak, dan harganya. Contoh:\n• ayam 1 kg 40k, telor 1 kg 28k\n• bensin 20rb\n• honor aslab 400k\n\nAku yang catat, masukkan ke pos, atur ulang anggaran kalau ada yang jebol, dan kasih peringatan.</div>';
      return;
    }
    box.innerHTML = state.chat.slice(-80).map(function (m) {
      return '<div class="msg ' + m.who + '">' + esc(m.text) + '<span class="time">' + hhmm(m.ts) + '</span></div>';
    }).join('');
  }
  function scrollChat() { window.scrollTo(0, document.body.scrollHeight); }

  function send(text) {
    text = text.trim();
    if (!text) return;
    if (!$('viewGizi').hidden) {
      gOffset = 0;
      var rg = G.handle(state, text, new Date());
      if (rg.hasil) { tampilCari(rg.q, rg.hasil); return; }
      $('gCariCard').hidden = true;
      save(); renderGizi();
      if (rg.reply) toast(rg.reply, rg.reply.indexOf('?') >= 0 ? 9000 : 5000);
      return;
    }
    addMsg('me', text);
    var res = K.handle(state, text, new Date());
    addMsg('bot', res.reply || 'Oke.');
    save();
    render(); renderChat();
    if (!$('viewChat').hidden) scrollChat();
    else toast(res.reply);
  }

  var toastTimer;
  function toast(text, ms) {
    var t = $('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 4500);
  }

  // ---------- Ringkasan mingguan otomatis ----------
  function maybeWeekly() {
    var now = Date.now();
    if (!state.lastSummary) { state.lastSummary = now; save(); return; }
    if (now - state.lastSummary >= 7 * 86400000) {
      addMsg('bot', K.weeklySummary(state, new Date()));
      state.lastSummary = now; save();
      $('badge').hidden = false;
    }
  }

  // ---------- Tab ----------
  function show(view) {
    var chat = view === 'chat', gizi = view === 'gizi', dash = !chat && !gizi;
    $('toast').hidden = true;
    $('viewDash').hidden = !dash; $('viewChat').hidden = !chat; $('viewGizi').hidden = !gizi;
    $('tabDash').setAttribute('aria-selected', String(dash));
    $('tabChat').setAttribute('aria-selected', String(chat));
    $('tabGizi').setAttribute('aria-selected', String(gizi));
    $('input').placeholder = gizi ? 'tempe rebus 30g, dada ayam 150g, telur 2 butir' : 'ayam 1 kg 40k, telor 1 kg 28k';
    $('input').setAttribute('aria-label', gizi ? 'Catat makanan' : 'Catat pengeluaran');
    if (chat) { $('badge').hidden = true; renderChat(); scrollChat(); }
    else if (gizi) { window.scrollTo(0, 0); renderGizi(); }
    else { window.scrollTo(0, 0); render(); }
  }

  // ---------- Gizi ----------
  var GWARNA = { kkal: 'var(--accent)', p: 'var(--c-p)', l: 'var(--c-l)', k: 'var(--c-k)', s: 'var(--c-s)' };
  function gTanggal() { var d = new Date(); d.setDate(d.getDate() + gOffset); return d; }
  function arc(r, frac, color, width) {
    var c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return '<circle class="track" cx="50%" cy="50%" r="' + r + '" stroke-width="' + width + '"/>' +
      '<circle class="arc" cx="50%" cy="50%" r="' + r + '" stroke-width="' + width + '" stroke="' + color + '" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '"/>';
  }
  function renderGizi() {
    G.ensure(state);
    var d = gTanggal(), key = G.dayKey(d);
    $('gDay').textContent = gOffset === 0 ? 'Hari ini' : gOffset === -1 ? 'Kemarin' : d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    $('gNext').disabled = gOffset >= 0;
    var r = G.ringkas(state, key), t = r.total, tg = r.target, f = G.fmt;
    $('gNoTarget').hidden = !!tg;
    if (tg) {
      var over = r.sisa < 0;
      $('gRing').innerHTML = '<svg viewBox="0 0 210 210" role="img" aria-label="Sisa kalori ' + Math.round(r.sisa) + ' dari ' + tg.kkal + ' kkal">' +
        arc(90, t.kkal / tg.kkal, over ? 'var(--critical)' : GWARNA.kkal, 16) +
        '<text x="105" y="96" text-anchor="middle" class="cap">' + (over ? 'Lebih' : 'Sisa') + '</text>' +
        '<text x="105" y="132" text-anchor="middle" class="num' + (over ? ' neg' : '') + '">' + Math.abs(Math.round(r.sisa)).toLocaleString('id-ID') + '</text>' +
        '<text x="105" y="154" text-anchor="middle" class="cap">kkal · ' + Math.round(t.kkal).toLocaleString('id-ID') + ' / ' + tg.kkal.toLocaleString('id-ID') + '</text></svg>';
      $('gMini').innerHTML = ['p', 'l', 'k', 's'].map(function (n) {
        var pct = r.persen[n], lebih = pct > 100 && n !== 'p' && n !== 's';
        return '<div class="mini"><svg viewBox="0 0 64 64" role="img" aria-label="' + G.LABEL[n] + ' ' + Math.round(pct) + ' persen">' +
          arc(26, pct / 100, lebih ? 'var(--critical)' : GWARNA[n], 7) +
          '<text x="32" y="37" text-anchor="middle" class="pct">' + Math.round(pct) + '%</text></svg>' +
          '<span class="nm">' + G.LABEL[n] + '</span><span class="gr">' + f(t[n]) + ' / ' + tg[n] + ' g</span></div>';
      }).join('');
    } else {
      $('gRing').innerHTML = '';
      $('gMini').innerHTML = ['p', 'l', 'k', 's'].map(function (n) {
        return '<div class="mini"><span class="nm">' + G.LABEL[n] + '</span><span class="gr">' + f(t[n]) + ' g</span></div>';
      }).join('');
    }
    if (r.komposisi) {
      var k = r.komposisi;
      $('gKomp').innerHTML = '<div class="label">Komposisi energi dari makro</div><div class="bar3">' +
        '<i style="width:' + k.p + '%;background:var(--c-p)"></i><i style="width:' + k.l + '%;background:var(--c-l)"></i><i style="width:' + k.k + '%;background:var(--c-k)"></i></div>' +
        '<div class="leg"><span style="--c:var(--c-p)">Protein ' + Math.round(k.p) + '%</span><span style="--c:var(--c-l)">Lemak ' + Math.round(k.l) + '%</span><span style="--c:var(--c-k)">Karbo ' + Math.round(k.k) + '%</span></div>';
    } else $('gKomp').innerHTML = '';
    $('gCount').textContent = r.entri.length ? r.entri.length + ' catatan · ' + Math.round(t.kkal) + ' kkal' : '';
    $('gList').innerHTML = r.entri.length ? r.entri.slice().reverse().map(function (e) {
      return '<div class="row"><div class="main"><div class="t">' + esc(e.label) + '</div><div class="m">' + hhmm(e.ts) + ' · ' + f(e.gram) + ' g' + (e.ket ? ' (' + esc(e.ket) + ')' : '') +
        ' · P ' + f(e.v.p) + ' · L ' + f(e.v.l) + ' · K ' + f(e.v.k) + ' · S ' + f(e.v.s) + '</div></div>' +
        '<div class="v">' + Math.round(e.v.kkal) + ' kkal</div>' +
        '<button class="del" data-gdel="' + e.id + '" aria-label="Hapus ' + esc(e.label) + '">' + ICON.x + '</button></div>';
    }).join('') : '<div class="empty">Belum ada catatan. Ketik di bawah, mis. <b>tempe rebus 30g, dada ayam 150g, telur 2 butir</b>.</div>';
  }

  function tampilCari(q, hs) {
    $('gCariJudul').textContent = 'Hasil "' + q + '" (' + hs.length + (hs.length >= 30 ? '+' : '') + ')';
    $('gCariList').innerHTML = hs.map(function (it) {
      return '<button class="row pick" data-kode="' + esc(it.k) + '"><div class="main"><div class="t">' + esc(it.n) + (it.m ? ' <span class="chip">siap makan</span>' : '') + '</div>' +
        '<div class="m">' + esc(it.k) + ' · P ' + G.fmt(it.g[1] || 0) + ' · L ' + G.fmt(it.g[2] || 0) + ' · K ' + G.fmt(it.g[3] || 0) + ' · S ' + (it.g[4] === null ? '–' : G.fmt(it.g[4])) + '</div></div>' +
        '<div class="v">' + Math.round(it.g[0]) + ' kkal</div></button>';
    }).join('');
    $('gCariCard').hidden = false;
    $('gCariCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function isiAktivitas() {
    $('cAkt').innerHTML = G.AKTIVITAS.map(function (a) { return '<option value="' + a.f + '">' + esc(a.n) + ' ×' + a.f + '</option>'; }).join('');
  }
  function angka(v) { var x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? null : x; }
  function cekTarget() {
    var kk = angka($('tKkal').value), p = angka($('tP').value), l = angka($('tL').value), k = angka($('tK').value);
    if (kk && p !== null && l !== null && k !== null) {
      var e = p * 4 + l * 9 + k * 4;
      $('tCek').textContent = 'Protein+lemak+karbo = ' + Math.round(e) + ' kkal' + (Math.abs(e - kk) > 50 ? ' (beda ' + Math.round(e - kk) + ' kkal dari target kalori)' : ' — cocok dengan target kalori.');
    } else $('tCek').textContent = '';
  }
  function openGiziSettings() {
    var g = G.ensure(state), t = g.target || {}, pr = g.profil || {};
    $('tKkal').value = t.kkal || ''; $('tP').value = t.p || ''; $('tL').value = t.l || ''; $('tK').value = t.k || ''; $('tS').value = t.s || '';
    $('tButir').value = g.butir;
    isiAktivitas();
    $('cBB').value = pr.bb || ''; $('cTB').value = pr.tb || ''; $('cUmur').value = pr.umur || '';
    $('cJK').value = pr.jk || 'L'; if (pr.aktivitas) $('cAkt').value = String(pr.aktivitas);
    $('cDef').value = pr.defisit !== undefined ? pr.defisit : ''; $('cProt').value = pr.protein_per_kg || ''; $('cLemak').value = pr.lemak_persen || '';
    $('cHasil').textContent = '';
    cekTarget();
    $('giziSettings').showModal();
  }

  // ---------- Pengaturan ----------
  function openSettings() {
    $('setIncome').value = state.settings.income;
    $('setPots').innerHTML = state.settings.pots.map(function (p) {
      return '<label class="field">' + esc(p.name) + '<input data-pot="' + p.id + '" inputmode="numeric" value="' + p.budget + '"></label>';
    }).join('');
    updateSum();
    $('settings').showModal();
  }
  function updateSum() {
    var inc = num($('setIncome').value);
    var sum = 0;
    document.querySelectorAll('#setPots input').forEach(function (i) { sum += num(i.value); });
    var diff = inc - sum;
    $('setSum').textContent = 'Total pos ' + K.rp(sum) + (diff === 0 ? ' — pas dengan uang bulanan.' : diff > 0 ? ' — masih sisa ' + K.rp(diff) + ' belum dibagi.' : ' — lebih ' + K.rp(-diff) + ' dari uang bulanan!');
  }
  function num(v) { return parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0; }

  // ---------- Init ----------
  state = load();
  K.ensureMonth(state, new Date());
  maybeWeekly();
  render(); renderChat();

  $('form').addEventListener('submit', function (e) { e.preventDefault(); var v = $('input').value; $('input').value = ''; send(v); });
  $('tabDash').onclick = function () { show('dash'); };
  $('tabChat').onclick = function () { show('chat'); };
  $('tabGizi').onclick = function () { show('gizi'); };
  $('gPrev').onclick = function () { gOffset--; renderGizi(); };
  $('gNext').onclick = function () { if (gOffset < 0) { gOffset++; renderGizi(); } };
  $('gSet').onclick = openGiziSettings;
  $('gSet2').onclick = openGiziSettings;
  $('gHints').onclick = function (e) {
    var d = e.target.dataset || {};
    if (d.q) send(d.q);
    else if (d.fill) { $('input').value = d.fill; $('input').focus(); }
  };
  $('gCariTutup').onclick = function () { $('gCariCard').hidden = true; };
  $('gCariList').onclick = function (e) {
    var b = e.target.closest('[data-kode]'); if (!b) return;
    $('input').value = b.dataset.kode + ' '; $('input').focus();
    toast('Dipilih: ' + b.querySelector('.t').textContent + '. Ketik beratnya, mis. 100g, lalu kirim.', 4000);
  };
  $('gList').onclick = function (e) {
    var b = e.target.closest('[data-gdel]'); if (!b) return;
    var x = G.hapus(state, G.dayKey(gTanggal()), b.dataset.gdel);
    if (x) toast('Dihapus: ' + x.label + ' (' + Math.round(x.v.kkal) + ' kkal)');
    save(); renderGizi();
  };
  $('giziSettings').addEventListener('input', cekTarget);
  $('cHitung').onclick = function () {
    var p = { bb: angka($('cBB').value), tb: angka($('cTB').value), umur: angka($('cUmur').value), jk: $('cJK').value,
      aktivitas: angka($('cAkt').value), defisit: angka($('cDef').value), protein_per_kg: angka($('cProt').value), lemak_persen: angka($('cLemak').value) };
    var kurang = Object.keys(p).filter(function (k) { return p[k] === null; });
    if (kurang.length) { $('cHasil').textContent = 'Lengkapi dulu semua kolom di bagian ini.'; return; }
    var h = G.hitungTarget(p);
    G.ensure(state).profil = p;
    $('tKkal').value = h.target.kkal; $('tP').value = h.target.p; $('tL').value = h.target.l; $('tK').value = h.target.k; $('tS').value = h.target.s;
    $('cHasil').textContent = 'BMR ' + h.bmr + ' kkal · kebutuhan harian (TDEE) ' + h.tdee + ' kkal · target ' + h.target.kkal + ' kkal setelah defisit ' + p.defisit + '. Cek angka di atas lalu tekan Simpan target.';
    cekTarget();
  };
  $('tSimpan').onclick = function () {
    var t = { kkal: angka($('tKkal').value), p: angka($('tP').value), l: angka($('tL').value), k: angka($('tK').value), s: angka($('tS').value) };
    if (Object.keys(t).some(function (k) { return !t[k] || t[k] <= 0; })) { $('tCek').textContent = 'Semua target harus diisi angka lebih dari 0.'; return; }
    var g = G.ensure(state); g.target = t;
    var b = angka($('tButir').value); if (b && b > 0) g.butir = b;
    save(); renderGizi(); $('giziSettings').close(); toast('Target gizi disimpan.');
  };
  $('hints').onclick = function (e) { var q = e.target.dataset && e.target.dataset.q; if (q) send(q); };
  $('txList').onclick = function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var id = b.dataset.del;
    Object.keys(state.months).forEach(function (k) {
      var m = state.months[k]; var i = m.tx.findIndex(function (t) { return t.id === id; });
      if (i >= 0) { var t = m.tx.splice(i, 1)[0]; toast('Dihapus: ' + cap(t.name) + ' ' + K.rp(t.price)); }
    });
    save(); render();
  };
  $('btnSettings').onclick = openSettings;
  $('settings').addEventListener('input', updateSum);
  $('btnSave').onclick = function () {
    state.settings.income = num($('setIncome').value);
    var key = K.monthKey(new Date());
    document.querySelectorAll('#setPots input').forEach(function (i) {
      var p = state.settings.pots.filter(function (x) { return x.id === i.dataset.pot; })[0];
      var v = num(i.value);
      if (p) { p.budget = v; state.months[key].budgets[p.id] = v; }
    });
    save(); render(); updateSum(); toast('Anggaran disimpan.');
  };
  $('btnBackup').onclick = function () {
    var raw = JSON.stringify(state, null, 1);
    var name = 'kasku-backup-' + K.dayKey(new Date()) + '.json';
    if (NATIVE && NATIVE.saveBackup) { toast(NATIVE.saveBackup(name, raw)); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    a.download = name; a.click();
  };
  $('btnRestore').onclick = function () { $('fileRestore').click(); };
  $('fileRestore').onchange = function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var s = JSON.parse(r.result);
        if (!s.settings || !s.months) throw new Error('format');
        state = s; save(); render(); renderChat(); toast('Backup dipulihkan.');
      } catch (e) { toast('File backup tidak valid.'); }
    };
    r.readAsText(f);
    this.value = '';
  };
  $('btnReset').onclick = function () {
    if (!confirm('Hapus semua catatan? Tidak bisa dibatalkan.')) return;
    state = K.newState(new Date()); save(); render(); renderChat(); toast('Semua data dihapus.');
  };
  window.addEventListener('resize', function () { if (!$('viewDash').hidden) render(); });
  G.ensure(state);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { K.ensureMonth(state, new Date()); maybeWeekly(); render(); if (!$('viewGizi').hidden) renderGizi(); } });
})();
