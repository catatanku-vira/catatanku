// ===== CONFIG (hanya bagian ini yang diganti saat pasang) =====
const CONFIG = {
  API: 'https://script.google.com/macros/s/AKfycbymOvrKqSLhunIBj6cu1mX-2jX5Dtrnk0cwxJsa_9Iv4ei4qvnXkmB9Lhl5Hn3dujit/exec',
  CLIENT_ID: '568227159508-em7vtqrhr81kom8bvelr714veosgforp.apps.googleusercontent.com',
  VERSI: '1.8'
};
// ===============================================================

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ck_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ck_' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('ck_' + k); } catch (e) {} }
};
// Data utama tetap di Sheet; yang di HP hanya salinan sementara + antrean kirim.
const S = {tok: LS.get('tok', ''), ring: LS.get('ring', null), master: LS.get('master', {toko: [], jenis: []}), q: LS.get('q', []), log: LS.get('log', []), riw: {}, layar: 'home'};
const UK = ['kecil', 'sedang', 'besar'];
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const ang = n => Number(n || 0).toLocaleString('id-ID');
const ymNow = () => new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Jakarta'}).slice(0, 7);
const wkt = t => new Date(t).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const bulanNama = ym => new Date(ym + '-15').toLocaleDateString('id-ID', {month: 'long', year: 'numeric'});

// Pembuat elemen aman: teks selalu jadi textNode (tidak pernah innerHTML dari data)
function h(t, a, ...c) {
  const e = document.createElement(t);
  for (const k in a || {}) { const v = a[k]; if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'cls') e.className = v; else e.setAttribute(k, v); }
  for (const x of c.flat()) if (x != null && x !== false) e.append(x instanceof Node ? x : String(x));
  return e;
}
const img = n => h('img', {src: './img/' + n + '.png', alt: ''});
const isi = (el, ...c) => { el.replaceChildren(...c.flat().filter(Boolean)); };

// ---------- log aktivitas & kecepatan (disimpan di HP 30 hari) ----------
function catat(aksi, hasil, ms, ok) {
  S.log.unshift({t: Date.now(), a: aksi, h: hasil, ms, ok});
  const batas = Date.now() - 30 * 864e5;
  S.log = S.log.filter(x => x.t > batas).slice(0, 1500);
  LS.set('log', S.log);
}

// ---------- kartu keterangan aksi ----------
let tKartu, t8;
function kartu(teks) {
  clearTimeout(tKartu); clearTimeout(t8);
  const k = $('#kartu'); k.hidden = false; k.className = 'kartu proses';
  $('#kartuImg').src = './img/profil.png'; $('#kartuT').textContent = teks; $('#kartuIk').className = 'ck jalan'; $('#kartuIk').textContent = '';
  t8 = setTimeout(() => { $('#kartuT').textContent = teks + ' Masih Diproses, Mohon Tunggu Sebentar…'; }, 8000);
}
function kartuSelesai(ok, teks, lama) {
  clearTimeout(tKartu); clearTimeout(t8);
  const k = $('#kartu'); k.hidden = false; k.className = 'kartu' + (ok ? '' : ' gagal');
  $('#kartuImg').src = './img/' + (ok ? 'happy' : 'worried') + '.png'; $('#kartuT').textContent = teks;
  $('#kartuIk').className = 'ck' + (ok ? '' : ' no'); $('#kartuIk').textContent = ok ? '✓' : '!';
  tKartu = setTimeout(() => { k.hidden = true; }, lama || (ok ? 2600 : 5000));
}

// ---------- panggil server ----------
async function api(aksi, data, label) {
  const t0 = performance.now(); let r;
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(CONFIG.API, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({aksi, token: S.tok, data: data || {}}), signal: ctl.signal});
    clearTimeout(to);
    r = await res.json();
  } catch (e) { r = {ok: false, net: true, pesan: navigator.onLine ? 'Server tidak menjawab' : 'Sinyal putus'}; }
  catat(label || aksi, r.ok ? 'Berhasil' : r.pesan, Math.round(performance.now() - t0), r.ok);
  if (!r.ok && r.kode === 'SESI') { keluarLokal('Sesi habis, silakan masuk lagi'); }
  return r;
}
// tombol: cegah klik ganda + setir berputar
async function sibuk(b, teks, fn) {
  if (b.disabled) return;
  const asli = b.textContent; b.disabled = true; b.classList.add('ld'); b.textContent = teks;
  try { return await fn(); } finally { b.disabled = false; b.classList.remove('ld'); b.textContent = asli; }
}
// cegah klik ganda untuk simpan instan (antrean): tombol dikunci 1,2 detik setelah ditekan
function sekali(b, fn) { b.addEventListener('click', () => { if (b.disabled) return; b.disabled = true; setTimeout(() => { b.disabled = false; }, 1200); fn(); }); }
// dialog konfirmasi/isian
function tanya(judul, pesan, opsi) {
  opsi = opsi || {};
  return new Promise(ok => {
    const d = $('#dlg'), inp = $('#dlgIn');
    $('#dlgJ').textContent = judul; $('#dlgP').textContent = pesan || ''; $('#dlgOk').textContent = opsi.ok || 'Ya';
    inp.hidden = !opsi.input; inp.value = ''; inp.placeholder = opsi.input || '';
    d.onclose = () => ok(d.returnValue === '1' ? (opsi.input ? inp.value.trim() : true) : false);
    d.showModal(); if (opsi.input) inp.focus();
  });
}

// ---------- antrean simpan di belakang layar ----------
function simpanQ() { LS.set('q', S.q); lencana(); }
function antre(aksi, data, label) {
  const id = uid(); // nomor tiket unik; dipakai ulang saat kirim ulang supaya tidak tercatat ganda
  S.q.push({id, aksi, data: Object.assign({}, data, {reqId: id}), label, t: Date.now(), st: 'tunggu'});
  simpanQ(); tampil(); kirimQ();
  return id;
}
let qJalan = false;
async function kirimQ() {
  if (qJalan || !S.tok) return; qJalan = true;
  try {
    for (const it of [...S.q]) {
      if (it.st === 'gagal' && !it.net && !it.ulang) continue; // gagal karena isian: tunggu Vira
      it.st = 'kirim'; it.ulang = false; simpanQ(); tampilAntrean();
      const r = await api(it.aksi, it.data, it.label);
      if (r.ok) {
        S.q = S.q.filter(x => x.id !== it.id); simpanQ();
        terimaRing(r.data.ring); hapusRiw(['bayar', undefined].includes(it.data.jenis) ? 'pengeluaran' : it.data.jenis);
      } else {
        it.st = 'gagal'; it.err = r.pesan; it.net = !!r.net; simpanQ();
        if (!r.net) { kartuSelesai(false, 'Gagal Tersimpan: ' + r.pesan + '. Cek Di Antrean.'); muatRing(); }
        else break; // sinyal putus: berhenti, urutan dijaga, dicoba lagi otomatis
      }
    }
  } finally { qJalan = false; tampil(); tampilAntrean(); }
}
setInterval(() => { if (S.q.some(x => x.net || x.st === 'tunggu')) kirimQ(); }, 30000);
addEventListener('online', kirimQ);
function lencana() {
  const n = S.q.length, b = $('#lencana');
  b.hidden = !n; $('#lencanaN').textContent = n + (S.q.some(x => x.st === 'gagal') ? ' Gagal' : ' Dikirim');
  b.classList.toggle('merah', S.q.some(x => x.st === 'gagal')); b.classList.toggle('jalan', S.q.some(x => x.st !== 'gagal'));
}

// ---------- ringkasan (server + yang masih di antrean) ----------
function terimaRing(r) {
  if (!r) return;
  S.ring = r; LS.set('ring', r); tampil();
  const a = r.arsip;
  if (a && a.id && LS.get('arsipLihat', '') !== a.id) { LS.set('arsipLihat', a.id); kartuSelesai(true, 'Arsip ' + a.tgl + ': Data Sampai ' + a.sampai + ' Dipindah Ke Arsip', 6000); }
}
async function muatRing() { const r = await api('ringkasan', {}, 'Segarkan Ringkasan'); if (r.ok) terimaRing(r.data); }
function efektif() {
  const r = JSON.parse(JSON.stringify(S.ring || {stok: {}, min: {}, kasbon: [], terakhir: []}));
  for (const it of S.q) {
    const d = it.data;
    if (it.st === 'gagal' && !it.net) continue;
    if (it.aksi === 'simpan' && d.jenis === 'kresek') r.stok[d.ukuran] = (r.stok[d.ukuran] || 0) + (d.arah === 'masuk' ? d.pak : -d.pak);
    if (it.aksi === 'simpan' && d.jenis === 'pengeluaran' && d.status === 'belum') r.kasbon.unshift({id: it.id, waktu: it.t, toko: d.toko, desk: d.desk, nominal: d.nominal, sisa: d.nominal, ket: d.ket, pend: 1});
    if (it.aksi === 'ubah') {
      if (d.jenis === 'kresek' && d.pak) r.stok[d.ukuran] = (r.stok[d.ukuran] || 0) + (d.arah === 'masuk' ? 1 : -1) * (d.pak - d.pakLama);
      if (d.jenis === 'pengeluaran') { const k = r.kasbon.find(x => x.id === d.id); if (k) { const bayar = k.nominal - k.sisa; Object.assign(k, {toko: d.toko, desk: d.desk, ket: d.ket, nominal: d.nominal, sisa: d.nominal - bayar, pend: 1}, d.tgl ? {waktu: d.tgl + 'T05:00:00Z'} : {}); } }
    }
    if (it.aksi === 'batal') {
      if (d.jenis === 'kresek') r.stok[d.ukuran] = (r.stok[d.ukuran] || 0) + (d.arah === 'masuk' ? -d.pak : d.pak);
      if (d.jenis === 'pengeluaran') r.kasbon = r.kasbon.filter(x => x.id !== d.id);
      if (d.jenis === 'bayar') { const k = r.kasbon.find(x => x.id === d.ref); if (k) k.sisa = Number(k.sisa) + Number(d.nominal); }
    }
    if (it.aksi === 'bayar' || it.aksi === 'lunas') { const k = r.kasbon.find(x => x.id === d.kasbonId); if (k) { k.sisa = it.aksi === 'lunas' ? 0 : Math.max(0, k.sisa - d.jumlah); k.pend = 1; } }
  }
  r.kasbon = r.kasbon.filter(k => Number(k.sisa) > 0);
  return r;
}
const warnaStok = (s, m) => m > 0 && s <= m / 2 ? 'r' : m > 0 && s <= m ? 'y' : '';
function kotakStok(r) {
  return UK.map(u => h('div', {cls: 'st ' + warnaStok(r.stok[u] || 0, r.min[u] || 0)}, u, h('div', {cls: 'n'}, ang(r.stok[u] || 0), ' ', h('small', {}, 'Pak')), h('div', {cls: 'm'}, 'Min ' + ang(r.min[u] || 0))));
}

// ---------- tampilan ----------
function tampil() {
  const r = efektif();
  isi($('#stokHome'), kotakStok(r)); isi($('#stokKresek'), kotakStok(r));
  // laporan kapten
  const lap = [];
  UK.forEach(u => { const w = warnaStok(r.stok[u] || 0, r.min[u] || 0); if (w) lap.push(h('button', {cls: 'row', onclick: () => buka('kresek')}, img(w === 'r' ? 'bell' : 'flag'), h('span', {cls: 't'}, 'Kresek ' + u + ' Tinggal ' + ang(r.stok[u]) + ' Pak'))); });
  if (r.kasbon.length) lap.push(h('button', {cls: 'row', onclick: () => buka('peng')}, img('jam'), h('span', {cls: 't'}, r.kasbon.length + ' Pengeluaran Belum Lunas')));
  if (S.q.some(x => x.st === 'gagal')) lap.push(h('button', {cls: 'row', onclick: () => buka('antrean')}, img('bell'), h('span', {cls: 't'}, 'Ada Catatan Gagal Terkirim')));
  isi($('#laporan'), lap.length ? lap : [h('div', {cls: 'row'}, img('lunas'), h('span', {cls: 't'}, 'Semua Aman, Kapten'))]);
  // catatan terakhir: yang di antrean dulu, lalu dari server
  const pend = S.q.slice().reverse().map(it => barisData(Object.assign({waktu: it.t}, it.data, it.aksi !== 'simpan' ? {jenis: 'bayar', nominal: it.data.jumlah, status: it.aksi === 'lunas' ? 'lunas' : ''} : {}), it.st === 'gagal' ? 'Gagal Terkirim' : 'Menunggu Kirim'));
  const ter = pend.concat((r.terakhir || []).map(x => barisData(x))).slice(0, 6);
  isi($('#terakhir'), ter.length ? ter : [h('div', {cls: 'kosong'}, 'Belum Ada Catatan Bulan Ini')]);
  // kasbon belum lunas
  $('#nBelum').textContent = r.kasbon.length;
  isi($('#pgBelum'), r.kasbon.length ? r.kasbon.map(kartuKasbon) : [h('div', {cls: 'card kosong'}, 'Semua Sudah Lunas, Kapten!')]);
  lencana();
}
function barisData(o, status, bisaBatal) {
  let ik = 'struk', judul = '', nilai = o.nominal ? rp(o.nominal) : '';
  if (o.jenis === 'kresek') { ik = o.arah === 'masuk' ? 'masuk' : 'jual'; judul = (o.arah === 'masuk' ? 'Stok Masuk' : o.toko) + ' · Kresek ' + o.ukuran; nilai = ang(o.pak) + ' Pak'; }
  else if (o.jenis === 'pengeluaran') judul = o.toko + ' · ' + o.desk + (o.status === 'belum' ? ' (Belum Lunas)' : '');
  else if (o.jenis === 'bayar') { ik = 'lunas'; judul = (o.toko ? o.toko + ' · ' : '') + 'Bayar Kasbon' + (o.status === 'lunas' ? ' (Lunas)' : ''); }
  else { ik = 'buku'; judul = (o.sub || '') + ' · ' + o.desk; }
  const batal = o.status === 'batal';
  const isiBaris = [img(ik), h('div', {cls: 't'}, judul, h('small', {cls: status ? 'pend' : ''}, (batal ? 'Dibatalkan · ' : '') + (status ? status + ' · ' : '') + wkt(o.waktu) + (o.ket ? ' · ' + o.ket : ''))), h('span', {cls: 'v'}, nilai)];
  if (!bisaBatal || batal || status) return h('div', {cls: 'row' + (batal ? ' batal' : '')}, isiBaris);
  if (o.jenis === 'bayar') return h('button', {cls: 'row', 'aria-label': 'Batalkan ' + judul, onclick: () => mintaBatal(o, judul + ' ' + nilai)}, isiBaris);
  return h('button', {cls: 'row', 'aria-label': 'Edit ' + judul, onclick: () => bukaEdit(o)}, isiBaris, h('span', {cls: 'pen kecil', 'aria-hidden': 'true'}, '✎'));
}
async function mintaBatal(o, teks) {
  if (!await tanya('Batalkan Catatan Ini?', teks + ' (' + wkt(o.waktu) + '). Angkanya akan dibalik, catatan tetap tersimpan sebagai "Dibatalkan".', {ok: 'Batalkan'})) return;
  const ym = new Date(o.waktu).toLocaleDateString('sv-SE', {timeZone: 'Asia/Jakarta'}).slice(0, 7);
  antre('batal', {id: o.id, bulan: ym, jenis: o.jenis, arah: o.arah, ukuran: o.ukuran, pak: Number(o.pak) || 0, nominal: Number(o.nominal) || 0, ref: o.ref}, 'Batalkan ' + teks);
  Object.values(S.riw).forEach(c => c.rows.forEach(x => { if (x.id === o.id) x.status = 'batal'; }));
  kartuSelesai(true, 'Dibatalkan, Tinggal Catat Ulang Yang Benar');
  if (['kresek', 'peng', 'prib'].includes(S.layar)) muatRiwayat($('#s-' + S.layar + ' .riw'));
}
function kartuKasbon(k) {
  const sudah = k.nominal - k.sisa, box = h('div', {cls: 'bayarBox', hidden: true});
  const inp = h('input', {cls: 'rp', inputmode: 'numeric', placeholder: 'Ketik Jumlah Bayar', 'aria-label': 'Jumlah bayar'});
  const sb = h('button', {cls: 'btn', onclick: () => {
    const j = nilaiRp(inp);
    if (!j) return kartuSelesai(false, 'Isi Jumlah Bayar Dulu');
    if (j > k.sisa) return kartuSelesai(false, 'Melebihi Sisa Kasbon (' + rp(k.sisa) + ')');
    antre('bayar', {kasbonId: k.id, jumlah: j}, 'Bayar ' + k.toko);
    kartuSelesai(true, 'Tersimpan Di HP, Sisa Jadi ' + rp(k.sisa - j));
  }}, 'Simpan Pembayaran');
  box.append(h('div', {cls: 'rpBox'}, inp, tombol000(inp)), sb); pasangRp(inp);
  return h('div', {cls: 'card k adaPen'}, k.pend ? null : pensil(Object.assign({jenis: 'pengeluaran', status: 'belum'}, k)),
    h('div', {cls: 'h'}, h('span', {}, k.toko + ' · ' + k.desk), h('span', {}, ang(k.nominal))),
    h('div', {cls: 's'}, wkt(k.waktu) + ' · ' + (sudah ? 'Sudah Bayar ' + ang(sudah) + ' · ' : 'Belum Bayar · ') + 'Sisa ' + ang(k.sisa) + (k.pend ? ' · Menunggu Kirim' : '') + (k.ket ? ' · ' + k.ket : '')),
    h('div', {cls: 'bar'}, h('i', {style: 'width:' + Math.round(sudah / k.nominal * 100) + '%'})),
    h('div', {cls: 'b2'}, h('button', {onclick: () => { box.hidden = !box.hidden; if (!box.hidden) inp.focus(); }}, 'Bayar Sebagian'),
      h('button', {cls: 'ok', onclick: async () => { if (await tanya('Tandai Lunas?', k.toko + ' · ' + k.desk + ', sisa ' + rp(k.sisa) + ' dianggap lunas.', {ok: 'Lunas'})) { antre('lunas', {kasbonId: k.id}, 'Lunas ' + k.toko); kartuSelesai(true, 'Kasbon ' + k.toko + ' Lunas'); } }}, '✓ Lunas')),
    box);
}

function kartuLunas(x) {
  const tgl = t => new Date(t).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
  return h('div', {cls: 'card k lunasK adaPen'}, pensil(x),
    h('div', {cls: 'h'}, h('span', {}, x.toko + ' · ' + x.desk), h('span', {}, ang(x.nominal))), h('div', {cls: 'stamp'}, 'LUNAS'),
    h('div', {cls: 's'}, 'Dicatat ' + tgl(x.waktu) + (x.lunas ? ' · Lunas ' + tgl(x.lunas) : '') + (x.ket ? ' · ' + x.ket : '')));
}

// ---------- tanggal: otomatis hari ini, boleh mundur sampai awal bulan ke-2 sebelumnya ----------
const hariIni = () => new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Jakarta'});
const tglMin = () => { const [y, m] = hariIni().split('-').map(Number), d = new Date(y, m - 3, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
const keTgl = t => new Date(t).toLocaleDateString('sv-SE', {timeZone: 'Asia/Jakarta'});
function aturTgl(el, nilai) { el.max = hariIni(); el.min = tglMin(); el.value = nilai || hariIni(); }
const ambilTgl = el => (!el.value || el.value === hariIni()) ? '' : el.value;
function cekTgl(el) { const v = el.value || hariIni(); if (v > hariIni()) return 'Tanggal Tidak Boleh Di Masa Depan'; if (v < tglMin()) return 'Tanggal Terlalu Lama (Sudah Diarsip)'; return ''; }
$$('.tgl').forEach(el => aturTgl(el));

// ---------- edit + batalkan lewat pensil (sama untuk Kresek, Pengeluaran, Pribadi) ----------
const pensil = o => h('button', {cls: 'pen', type: 'button', 'aria-label': 'Edit', onclick: e => { e.stopPropagation(); bukaEdit(o); }}, '✎');
function bukaEdit(o) {
  const d = $('#dlgEdit'), f = $('#edForm'), tgl = h('input', {type: 'date', 'aria-label': 'Tanggal'}); aturTgl(tgl, keTgl(o.waktu));
  const pilihan = (list, nilai) => h('select', {}, [...new Set([nilai, ...list].filter(Boolean))].map(x => h('option', {value: x, selected: x === nilai ? '' : null}, x)));
  const terbayar = o.jenis === 'pengeluaran' && (o.status === 'lunas' || (o.sisa !== '' && o.sisa != null && Number(o.sisa) !== Number(o.nominal)));
  const isian = {}, el = [h('b', {cls: 'edJ', tabindex: '-1'}, 'Edit Catatan'), h('div', {cls: 'lb'}, 'Tanggal'), tgl];
  if (o.jenis === 'kresek') {
    el.push(h('p', {cls: 'info'}, (o.arah === 'masuk' ? 'Stok Masuk' : 'Jual Ke Toko') + ' · Kresek ' + o.ukuran));
    if (o.arah === 'jual') { isian.toko = pilihan(S.master.toko, o.toko); el.push(h('div', {cls: 'lb'}, 'Toko'), isian.toko); }
    isian.pak = h('input', {inputmode: 'numeric', value: o.pak, 'aria-label': 'Jumlah pak'}); el.push(h('div', {cls: 'lb'}, 'Jumlah Pak'), isian.pak);
  } else if (o.jenis === 'pengeluaran') {
    isian.toko = pilihan(S.master.toko, o.toko); isian.desk = pilihan(S.master.jenis, o.desk);
    isian.nominal = h('input', {cls: 'rp', inputmode: 'numeric', value: ang(o.nominal), disabled: terbayar ? '' : null, 'aria-label': 'Nominal'});
    isian.ket = h('input', {maxlength: 120, value: o.ket || '', placeholder: 'Uang Penitipan', 'aria-label': 'Keterangan'});
    el.push(h('div', {cls: 'lb'}, 'Toko'), isian.toko, h('div', {cls: 'lb'}, 'Jenis'), isian.desk, h('div', {cls: 'lb'}, 'Nominal'), isian.nominal);
    if (terbayar) el.push(h('p', {cls: 'info'}, 'Nominal Terkunci Karena Sudah Ada Pembayaran'));
    el.push(h('div', {cls: 'lb'}, 'Keterangan'), isian.ket);
  } else {
    isian.sub = pilihan(['CV', 'OP'], o.sub); isian.desk = h('input', {maxlength: 60, value: o.desk, 'aria-label': 'Deskripsi'});
    isian.nominal = h('input', {cls: 'rp', inputmode: 'numeric', value: ang(o.nominal), 'aria-label': 'Nominal'});
    el.push(h('div', {cls: 'lb'}, 'CV / OP'), isian.sub, h('div', {cls: 'lb'}, 'Deskripsi'), isian.desk, h('div', {cls: 'lb'}, 'Nominal'), isian.nominal);
  }
  if (isian.nominal) pasangRp(isian.nominal);
  if (isian.pak) { isian.pak.addEventListener('focus', () => isian.pak.select()); isian.pak.addEventListener('input', () => { isian.pak.value = isian.pak.value.replace(/\D/g, '').slice(0, 5); }); }
  const pesan = h('p', {cls: 'lgPesan', role: 'alert'});
  const simpan = h('button', {cls: 'btn', type: 'button', onclick: () => {
    const v = {tgl: tgl.value === keTgl(o.waktu) ? '' : tgl.value}, salahTgl = cekTgl(tgl);
    if (salahTgl) return pesan.textContent = salahTgl;
    if (isian.toko) v.toko = isian.toko.value;
    if (isian.desk) v.desk = (isian.desk.value || '').trim();
    if (isian.ket) v.ket = isian.ket.value.trim().slice(0, 120);
    if (isian.sub) v.sub = isian.sub.value;
    if (isian.nominal) v.nominal = terbayar ? Number(o.nominal) : nilaiRp(isian.nominal);
    if (isian.pak) v.pak = Number(isian.pak.value) || 0;
    if (isian.desk && !v.desk) return pesan.textContent = 'Isian Tidak Boleh Kosong';
    if ('nominal' in v && !v.nominal) return pesan.textContent = 'Nominal Tidak Boleh Kosong';
    if ('pak' in v && v.pak < 1) return pesan.textContent = 'Jumlah Pak Minimal 1';
    d.close();
    const ym = keTgl(o.waktu).slice(0, 7);
    antre('ubah', Object.assign({id: o.id, bulan: ym, jenis: o.jenis, arah: o.arah, ukuran: o.ukuran, pakLama: Number(o.pak) || 0}, v), 'Edit ' + (o.toko || o.desk || o.jenis));
    Object.values(S.riw).forEach(c => c.rows.forEach(x => { if (x.id === o.id) Object.assign(x, v, v.tgl ? {waktu: v.tgl + 'T05:00:00Z'} : {}); }));
    kartuSelesai(true, 'Perubahan Tersimpan Di HP, Sedang Dikirim'); tampil();
    if (['kresek', 'peng', 'prib'].includes(S.layar)) muatRiwayat($('#s-' + S.layar + ' .riw'));
  }}, 'Simpan Perubahan');
  const batal = h('button', {cls: 'btn hapus', type: 'button', onclick: () => { d.close(); mintaBatal(o, (o.toko || o.desk || '') + ' ' + (o.jenis === 'kresek' ? ang(o.pak) + ' Pak' : rp(o.nominal))); }}, 'Batalkan Catatan Ini');
  isi(f, el, pesan, h('div', {cls: 'dlgBtn'}, h('button', {cls: 'btn alt', value: '0'}, 'Tutup'), simpan), batal);
  d.showModal(); f.querySelector('.edJ').focus(); // jangan langsung membuka kalender; tanggal dipilih sendiri bila perlu
}

// ---------- isian rupiah: kosong saat diketuk, titik ribuan otomatis ----------
function pasangRp(el) {
  el.addEventListener('focus', () => { el.value = ''; });
  el.addEventListener('input', () => { const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12); el.value = d ? ang(d) : ''; });
}
const nilaiRp = el => Number(el.value.replace(/\D/g, '')) || 0;
function tombol000(inp) { return h('button', {cls: 'k000', type: 'button', 'aria-label': 'Tambah tiga nol', onclick: () => { const d = inp.value.replace(/\D/g, ''); if (d) inp.value = ang(d + '000'); }}, '000'); }
$$('.rp').forEach(pasangRp);
$$('.rpBox .k000').forEach(b => b.onclick = () => { const i = b.previousElementSibling, d = i.value.replace(/\D/g, ''); if (d) i.value = ang(d + '000'); });
$$('.angka').forEach(el => { el.addEventListener('focus', () => el.select()); el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, 6); }); });

// ---------- pilihan (chips) ----------
function chipsPilih(wadah, fn) { wadah.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; $$('#' + wadah.id + ' button').forEach(x => x.classList.toggle('on', x === b)); fn && fn(b.dataset.v); }); }
const dipilih = wadah => { const b = wadah.querySelector('.on'); return b ? b.dataset.v : ''; };
function isiChips(wadah, list, tipe) {
  const lama = dipilih(wadah);
  isi(wadah, list.map(n => h('button', {'data-v': n, cls: n === lama ? 'on' : ''}, n)),
    h('button', {cls: 'add', onclick: async () => {
      const n = await tanya('Tambah ' + (tipe === 'toko' ? 'Toko' : 'Jenis'), '', {input: 'Nama', ok: 'Tambah'});
      if (n) await ubahMaster(tipe, n, false);
    }}, '+ Tambah'));
}
async function ubahMaster(tipe, nama, hapus) {
  kartu(hapus ? 'Sedang Menghapus…' : 'Sedang Menambah…');
  const r = await api('kelolaMaster', {tipe, nama, hapus}, (hapus ? 'Hapus ' : 'Tambah ') + tipe);
  if (r.ok) { S.master = r.data; LS.set('master', r.data); tampilMaster(); kartuSelesai(true, hapus ? 'Sudah Dihapus' : 'Sudah Ditambah'); }
  else kartuSelesai(false, r.pesan);
}
function tampilMaster() {
  isiChips($('#krToko'), S.master.toko, 'toko'); isiChips($('#pgToko'), S.master.toko, 'toko'); isiChips($('#pgJenis'), S.master.jenis, 'jenis');
  const kelola = (w, list, tipe) => isi(w, list.map(n => h('button', {cls: 'x', onclick: async () => { if (await tanya('Hapus ' + n + '?', 'Catatan lama tidak ikut terhapus.', {ok: 'Hapus'})) ubahMaster(tipe, n, true); }}, n, h('i', {}, '✕'))));
  kelola($('#setToko'), S.master.toko, 'toko'); kelola($('#setJenis'), S.master.jenis, 'jenis');
}
['krToko', 'pgToko', 'pgJenis', 'krUkuran'].forEach(id => chipsPilih($('#' + id)));
chipsPilih($('#krArah'), v => { $('#krTokoBox').hidden = v === 'masuk'; });

// ---------- Kresek ----------
const qty = $('#qty');
qty.addEventListener('focus', () => { qty.value = ''; });
qty.addEventListener('input', () => { qty.value = qty.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5); });
qty.addEventListener('blur', () => { if (!qty.value) qty.value = '1'; });
$('#qMin').onclick = () => { qty.value = Math.max(1, (+qty.value || 1) - 1); };
$('#qPlus').onclick = () => { qty.value = Math.min(99999, (+qty.value || 0) + 1); };
sekali($('#krSimpan'), () => {
  const arah = dipilih($('#krArah')), ukuran = dipilih($('#krUkuran')), toko = dipilih($('#krToko')), pak = +qty.value || 0;
  if (!ukuran) return kartuSelesai(false, 'Pilih Ukuran Dulu');
  if (arah === 'jual' && !toko) return kartuSelesai(false, 'Pilih Toko Dulu');
  if (pak < 1) return kartuSelesai(false, 'Jumlah Pak Minimal 1');
  if (cekTgl($('#krTgl'))) return kartuSelesai(false, cekTgl($('#krTgl')));
  const stok = efektif().stok[ukuran] || 0;
  if (arah === 'jual' && pak > stok) return kartuSelesai(false, 'Stok Kresek ' + ukuran + ' Tinggal ' + stok + ' Pak');
  antre('simpan', {jenis: 'kresek', arah, ukuran, pak, toko: arah === 'jual' ? toko : '', tgl: ambilTgl($('#krTgl'))}, (arah === 'masuk' ? 'Stok Masuk ' : 'Jual ') + ukuran);
  kartuSelesai(true, 'Tersimpan, Stok ' + ukuran + ' Jadi ' + (stok + (arah === 'masuk' ? pak : -pak)) + ' Pak');
  qty.value = '1'; aturTgl($('#krTgl'));
});

// ---------- Pengeluaran ----------
sekali($('#pgSimpan'), () => {
  const toko = dipilih($('#pgToko')), desk = dipilih($('#pgJenis')), nominal = nilaiRp($('#pgNom')), status = 'belum'; // semua pengeluaran mulai Belum Lunas
  if (!toko) return kartuSelesai(false, 'Pilih Toko Dulu');
  if (!desk) return kartuSelesai(false, 'Pilih Jenis Dulu');
  if (!nominal) return kartuSelesai(false, 'Isi Nominal Dulu');
  if (cekTgl($('#pgTgl'))) return kartuSelesai(false, cekTgl($('#pgTgl')));
  antre('simpan', {jenis: 'pengeluaran', toko, desk, nominal, status, ket: $('#pgKet').value.trim().slice(0, 120), tgl: ambilTgl($('#pgTgl'))}, 'Pengeluaran ' + toko);
  kartuSelesai(true, 'Tersimpan Di HP: ' + toko + ' · ' + desk + ' ' + rp(nominal));
  $('#pgNom').value = ''; $('#pgKet').value = ''; aturTgl($('#pgTgl'));
});
chipsPilih($('#pgTab'), v => { const riw = $('#s-peng .riw'); $('#pgBelum').hidden = v !== 'belum'; riw.hidden = v === 'belum'; if (v !== 'belum') muatRiwayat(riw, v); });

// ---------- Pribadi ----------
chipsPilih($('#prSub'), v => { $('#prNama').textContent = v; $('#prSimpan').textContent = 'Simpan Ke ' + v; muatRiwayat($('#s-prib .riw')); });
sekali($('#prSimpan'), () => {
  const sub = dipilih($('#prSub')), desk = $('#prDesk').value.trim(), nominal = nilaiRp($('#prNom'));
  if (!desk) return kartuSelesai(false, 'Isi Deskripsi Dulu');
  if (!nominal) return kartuSelesai(false, 'Isi Nominal Dulu');
  if (cekTgl($('#prTgl'))) return kartuSelesai(false, cekTgl($('#prTgl')));
  antre('simpan', {jenis: 'pribadi', sub, desk: desk.slice(0, 60), nominal, tgl: ambilTgl($('#prTgl'))}, 'Pribadi ' + sub);
  kartuSelesai(true, 'Tersimpan Di HP: ' + sub + ' · ' + desk + ' ' + rp(nominal));
  $('#prDesk').value = ''; $('#prNom').value = ''; aturTgl($('#prTgl')); muatRiwayat($('#s-prib .riw'));
});

// ---------- Riwayat per bulan (laci): hanya bulan yang dipilih yang dibaca ----------
function hapusRiw(jenis) { Object.keys(S.riw).forEach(k => { if (k.endsWith('|' + jenis)) delete S.riw[k]; }); if (['kresek', 'peng', 'prib'].includes(S.layar)) muatRiwayat($('#s-' + S.layar + ' .riw')); }
async function muatRiwayat(wadah, mode) {
  if (!wadah || wadah.hidden) return;
  const jenis = wadah.dataset.jenis, ym = wadah.dataset.ym || ymNow(), key = ym + '|' + jenis;
  mode = mode || (jenis === 'pengeluaran' ? dipilih($('#pgTab')) : '');
  const pilihBln = h('input', {type: 'month', value: ym, max: ymNow(), 'aria-label': 'Pilih bulan', onchange: e => { if (e.target.value) { wadah.dataset.ym = e.target.value; muatRiwayat(wadah); } }});
  const kepala = h('div', {cls: 'riwHead'}, h('b', {}, 'Riwayat ' + bulanNama(ym)), pilihBln);
  let c = S.riw[key];
  if (!c || Date.now() - c.t > 3e5) {
    isi(wadah, kepala, h('div', {cls: 'card kosong'}, h('span', {cls: 'setir putar', style: 'display:inline-block;width:28px;height:28px'}), h('div', {}, 'Sedang Mengambil Riwayat ' + bulanNama(ym) + '…')));
    const r = await api('riwayat', {bulan: ym, jenis}, 'Ambil Riwayat ' + jenis);
    if (!r.ok) { isi(wadah, kepala, h('div', {cls: 'card kosong'}, 'Gagal Mengambil Riwayat. ', h('button', {cls: 'btn alt', onclick: () => muatRiwayat(wadah)}, 'Coba Lagi'))); return; }
    c = S.riw[key] = {t: Date.now(), rows: r.data};
  }
  let rows = c.rows;
  if (jenis === 'pribadi') {
    const sub = dipilih($('#prSub')); rows = rows.filter(x => x.sub === sub);
    // total ikut bulan yang dipilih; catatan yang dibatalkan tidak dihitung
    const tunggu = S.q.filter(x => x.aksi === 'simpan' && x.data.jenis === 'pribadi' && x.data.sub === sub && (x.data.tgl ? x.data.tgl.slice(0, 7) : ymNow()) === ym);
    const tot = rows.filter(x => x.status !== 'batal').reduce((a, x) => a + Number(x.nominal || 0), 0) + tunggu.reduce((a, x) => a + x.data.nominal, 0);
    $('#prTot').textContent = rp(tot); $('#prBln').textContent = bulanNama(ym);
  }
  if (mode === 'lunas') {
    const ls = rows.filter(x => x.jenis === 'pengeluaran' && x.status === 'lunas');
    return isi(wadah, kepala, ls.length ? ls.map(kartuLunas) : [h('div', {cls: 'card kosong'}, 'Belum Ada Yang Lunas Di Bulan Ini')]);
  }
  const pend = S.q.filter(x => x.aksi === 'simpan' && x.data.jenis === jenis && ym === (x.data.tgl ? x.data.tgl.slice(0, 7) : ymNow()) && (jenis !== 'pribadi' || x.data.sub === dipilih($('#prSub')))).reverse().map(it => barisData(Object.assign({waktu: it.data.tgl ? it.data.tgl + 'T05:00:00Z' : it.t}, it.data), it.st === 'gagal' ? 'Gagal Terkirim' : 'Menunggu Kirim'));
  const list = pend.concat(rows.slice(0, 300).map(x => barisData(x, '', true)));
  isi(wadah, kepala, h('div', {cls: 'card'}, list.length ? list : [h('div', {cls: 'kosong'}, 'Belum Ada Catatan Di Bulan Ini')]));
}

// ---------- Pengaturan ----------
$('#minSimpan').onclick = e => sibuk(e.target, 'Menyimpan…', async () => {
  kartu('Sedang Menyimpan Minimal Stok…');
  const r = await api('aturMinimal', {kecil: +$('#minK').value || 0, sedang: +$('#minS').value || 0, besar: +$('#minB').value || 0}, 'Atur Minimal Stok');
  if (r.ok) { terimaRing(r.data.ring); kartuSelesai(true, 'Minimal Stok Tersimpan'); } else kartuSelesai(false, r.pesan);
});
function isiMinimal() { const m = (S.ring && S.ring.min) || {}; $('#minK').value = m.kecil || 0; $('#minS').value = m.sedang || 0; $('#minB').value = m.besar || 0; }
$('#btnIos').onclick = () => tanya('Pasang Di iPhone', 'Buka alamat aplikasi di Safari → ketuk tombol Bagikan (kotak panah ke atas) → pilih "Tambah ke Layar Utama" → Tambah.', {ok: 'Oke'});
$('#versi').textContent = 'Catatanku Versi ' + CONFIG.VERSI;

// ---------- Log ----------
let logMode = 'semua';
chipsPilih($('#logTab'), v => { logMode = v; tampilLog(); });
function kelasMs(x) { return !x.ok ? 'vs' : x.ms > 5000 ? 'vs' : x.ms > 2000 ? 'sl' : 'ok'; }
function tampilLog() {
  const hariIni = S.log.filter(x => new Date(x.t).toDateString() === new Date().toDateString());
  const lambat = hariIni.filter(x => x.ok && x.ms > 2000).length, gagal = hariIni.filter(x => !x.ok).length;
  isi($('#logSum'), [['Hari Ini', hariIni.length, 'Aktivitas', ''], ['Lambat', lambat, 'Di Atas 2 Dtk', lambat ? 'y' : ''], ['Gagal', gagal, 'Aktivitas', gagal ? 'r' : '']].map(([a, n, m, c]) => h('div', {cls: 'st ' + c}, a, h('div', {cls: 'n'}, n), h('div', {cls: 'm'}, m))));
  const rata = {}; S.log.filter(x => x.ok).forEach(x => { (rata[x.a] = rata[x.a] || []).push(x.ms); });
  const top = Object.entries(rata).map(([a, v]) => [a, v.reduce((p, q) => p + q, 0) / v.length]).filter(x => x[1] > 2000).sort((a, b) => b[1] - a[1]).slice(0, 2);
  $('#logLambat').textContent = top.length ? 'Paling Sering Lambat: ' + top.map(([a, ms]) => a + ' (Rata-Rata ' + (ms / 1000).toFixed(1).replace('.', ',') + ' Dtk)').join(' Dan ') : 'Belum Ada Proses Yang Lambat. Mantap, Kapten!';
  const list = S.log.filter(x => logMode === 'semua' || (logMode === 'gagal' ? !x.ok : x.ok && x.ms > 2000)).slice(0, 200);
  isi($('#logList'), list.length ? list.map(x => h('div', {cls: 'lg'}, h('span', {cls: 'tm'}, wkt(x.t)), h('div', {cls: 't'}, x.a, h('small', {}, x.h)), h('span', {cls: 'sp ' + kelasMs(x)}, x.ok ? (x.ms / 1000).toFixed(1).replace('.', ',') + ' Dtk' + (x.ms > 5000 ? ' · Sangat Lambat' : x.ms > 2000 ? ' · Lambat' : '') : 'Gagal'))) : [h('div', {cls: 'kosong'}, 'Belum Ada Catatan')]);
}
$('#logSalin').onclick = async () => {
  const teks = 'LOG CATATANKU v' + CONFIG.VERSI + ' (' + navigator.userAgent + ')\n' + S.log.slice(0, 300).map(x => new Date(x.t).toISOString() + ' | ' + x.a + ' | ' + x.h + ' | ' + x.ms + 'ms').join('\n');
  try { await navigator.clipboard.writeText(teks); kartuSelesai(true, 'Log Tersalin, Tinggal Tempel Ke Chat Claude'); } catch (e) { kartuSelesai(false, 'Gagal Menyalin Log'); }
};

// ---------- Riwayat arsip ----------
async function tampilArsip() {
  isi($('#arsipList'), h('div', {cls: 'kosong'}, 'Sedang Mengambil Riwayat Arsip…'));
  const r = await api('riwayatArsip', {}, 'Ambil Riwayat Arsip');
  if (!r.ok) return isi($('#arsipList'), h('div', {cls: 'kosong'}, r.pesan));
  isi($('#arsipList'), r.data.length ? r.data.map(a => h('div', {cls: 'row'}, h('i', {cls: 'ck' + (String(a.status).startsWith('Berhasil') ? '' : ' no')}, String(a.status).startsWith('Berhasil') ? '✓' : '!'),
    h('div', {cls: 't'}, wkt(a.waktu) + ' · ' + a.oleh, h('small', {}, a.status === 'Berhasil' ? 'Data Sampai ' + a.sampai + ' · ' + a.jumlah + ' Baris' + (a.ditahan ? ' · ' + a.ditahan + ' Ditahan (Kasbon Belum Lunas)' : '') + (a.susulan ? ' · ' + a.susulan + ' Susulan' : '') : a.status)))) : [h('div', {cls: 'kosong'}, 'Belum Pernah Ada Arsip')]);
}
$('#arsipNow').onclick = async e => {
  if (!await tanya('Arsip Sekarang?', 'Data lebih lama dari 3 bulan dipindah ke file Arsip. Kasbon belum lunas tetap ditahan.', {ok: 'Arsipkan'})) return;
  sibuk(e.target, 'Mengarsipkan…', async () => {
    kartu('Sedang Mengarsipkan Data Lama…');
    const r = await api('arsipSekarang', {}, 'Arsip Manual');
    if (r.ok) { terimaRing(r.data.ring); kartuSelesai(true, 'Arsip Selesai: ' + r.data.info.tot + ' Baris Dipindah'); tampilArsip(); } else kartuSelesai(false, r.pesan);
  });
};

// ---------- Antrean ----------
function tampilAntrean() {
  if (S.layar !== 'antrean') return;
  isi($('#qList'), S.q.length ? S.q.map(it => h('div', {cls: 'row'}, h('i', {cls: 'ck' + (it.st === 'gagal' ? ' no' : ' jalan')}, it.st === 'gagal' ? '!' : ''),
    h('div', {cls: 't'}, it.label, h('small', {}, (it.st === 'gagal' ? 'Gagal: ' + it.err : it.st === 'kirim' ? 'Sedang Dikirim…' : 'Menunggu Giliran') + ' · ' + wkt(it.t))),
    it.st === 'gagal' && !it.net ? h('button', {cls: 'k000', onclick: async () => { if (await tanya('Buang Catatan Ini?', it.label + ' tidak akan dikirim. Gagal karena: ' + it.err, {ok: 'Buang'})) { S.q = S.q.filter(x => x.id !== it.id); catat('Buang Antrean ' + it.label, 'Dibuang Vira', 0, true); simpanQ(); tampil(); tampilAntrean(); } }}, 'Buang') : null))
    : [h('div', {cls: 'kosong'}, 'Semua Catatan Sudah Masuk Sheet ✓')]);
}
$('#qUlang').onclick = () => { S.q.forEach(x => { if (x.st === 'gagal') x.ulang = true; }); kirimQ(); };

// ---------- navigasi (tanpa menunggu server) ----------
const JUDUL = {home: 'Catatanku', kresek: 'Stok Kresek', peng: 'Pengeluaran', prib: 'Catatan Pribadi', set: 'Pengaturan', log: 'Log Aktivitas', arsip: 'Riwayat Arsip', antrean: 'Antrean Simpan'};
function buka(id, dariRiwayat) {
  $('#sheet').hidden = true;
  if (!dariRiwayat && id !== S.layar) history.pushState({s: id}, '');
  S.layar = id;
  $$('.sc').forEach(s => { s.hidden = s.id !== 's-' + id; });
  $$('.nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  $('#judul').textContent = JUDUL[id];
  scrollTo(0, 0);
  $$('.hero video').forEach(v => id === 'home' ? v.play().catch(() => {}) : v.pause());
  if (id === 'prib' && !dariRiwayat) delete $('#s-prib .riw').dataset.ym; // buka lagi = kembali ke bulan berjalan
  if (id === 'kresek' || id === 'prib') muatRiwayat($('#s-' + id + ' .riw'));
  if (id === 'peng' && dipilih($('#pgTab')) !== 'belum') muatRiwayat($('#s-peng .riw'));
  if (id === 'set') isiMinimal();
  if (id === 'log') tampilLog();
  if (id === 'arsip') tampilArsip();
  if (id === 'antrean') tampilAntrean();
}
addEventListener('popstate', e => buka((e.state && e.state.s) || 'home', true));
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) buka(b.dataset.go); });
$('#btnPlus').onclick = () => { $('#sheet').hidden = false; };
$('#sheet').onclick = e => { if (e.target.id === 'sheet') $('#sheet').hidden = true; };
$('#btnSet').onclick = () => buka('set');
$('#lencana').onclick = () => buka('antrean');
document.addEventListener('visibilitychange', () => $$('video').forEach(v => { if (document.hidden) v.pause(); else if (!v.closest('[hidden]')) v.play().catch(() => {}); }));

// ---------- login / logout ----------
// video login: tegak (9:16) di HP, lebar (16:9) di laptop
const layarLebar = matchMedia('(min-width:900px) and (orientation:landscape)');
function pilihVideoLogin() {
  const v = $('#lgVid'), f = layarLebar.matches ? 'login-wide' : 'login';
  if (v.dataset.f === f) return;
  v.dataset.f = f; v.poster = './img/' + f + '.jpg'; v.src = './img/' + f + '.mp4';
  if (!$('#login').hidden) v.play().catch(() => {});
}
layarLebar.addEventListener('change', pilihVideoLogin);
function tampilLogin(pesan) {
  $('#app').hidden = true; $('#login').hidden = false; $('#lgPesan').textContent = pesan || '';
  pilihVideoLogin(); $('#lgVid').play().catch(() => {});
  const pasang = () => {
    if (!window.google || !google.accounts) return setTimeout(pasang, 200);
    google.accounts.id.initialize({client_id: CONFIG.CLIENT_ID, callback: masukGoogle, auto_select: false});
    google.accounts.id.renderButton($('#gBtn'), {theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 280});
  };
  pasang();
}
async function masukGoogle(resp) {
  $('#lgPesan').textContent = '';
  kartu('Sedang Memeriksa Akun…');
  const r = await api('login', {credential: resp.credential}, 'Masuk');
  if (!r.ok) return kartuSelesai(false, r.pesan);
  S.tok = r.data.token; LS.set('tok', S.tok); LS.set('nama', r.data.nama);
  kartuSelesai(true, 'Selamat Datang, ' + r.data.nama + '!');
  mulai();
}
function keluarLokal(pesan) {
  S.tok = ''; S.ring = null; S.riw = {}; ['tok', 'ring'].forEach(LS.del);
  tampilLogin(pesan);
}
$('#avatar').onclick = async () => {
  if (S.q.length) {
    if (!await tanya('Masih Ada ' + S.q.length + ' Catatan Belum Terkirim', 'Tunggu sampai semuanya masuk Sheet dulu, baru keluar.', {ok: 'Kirim Sekarang'})) return;
    S.q.forEach(x => { x.ulang = true; }); await kirimQ();
    if (S.q.length) return kartuSelesai(false, 'Masih Ada Yang Belum Terkirim. Cek Antrean Dulu.');
  }
  if (!await tanya('Keluar Dari Catatanku?', 'Kamu perlu masuk lagi dengan Google.', {ok: 'Keluar'})) return;
  kartu('Sedang Keluar…');
  const r = await api('logout', {}, 'Keluar');
  if (!r.ok && !r.net && r.kode !== 'SESI') return kartuSelesai(false, r.pesan);
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  kartuSelesai(true, 'Sudah Keluar. Sampai Jumpa, Kapten!');
  keluarLokal();
};

// ---------- segarkan otomatis (tanpa tombol refresh) ----------
// Saat jendela dibuka lagi, dan tiap 1 menit selama jendela dilihat: ambil ringkasan + riwayat layar ini.
let terakhirSegar = Date.now(), lagiSegar = false;
async function segarkan() {
  if (!S.tok || lagiSegar || document.hidden || $('#app').hidden || S.q.some(x => x.st !== 'gagal')) return;
  if (Date.now() - terakhirSegar < 20000) return;
  lagiSegar = true; terakhirSegar = Date.now();
  try {
    await muatRing();
    const w = ['kresek', 'peng', 'prib'].includes(S.layar) ? $('#s-' + S.layar + ' .riw') : null;
    if (w && !w.hidden && !$('#dlgEdit').open) { // ambil diam-diam, baru ganti tampilan (tanpa kedip loading)
      const ym = w.dataset.ym || ymNow(), r = await api('riwayat', {bulan: ym, jenis: w.dataset.jenis}, 'Segarkan Riwayat');
      if (r.ok) { S.riw[ym + '|' + w.dataset.jenis] = {t: Date.now(), rows: r.data}; muatRiwayat(w); }
    }
  } finally { lagiSegar = false; }
}
document.addEventListener('visibilitychange', segarkan);
addEventListener('focus', segarkan);
setInterval(segarkan, 60000);

// ---------- mulai ----------
function sapaan() { const j = +new Date().toLocaleString('en-US', {hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta'}); return (j < 11 ? 'Selamat Pagi' : j < 15 ? 'Selamat Siang' : j < 18 ? 'Selamat Sore' : 'Selamat Malam') + ', ' + LS.get('nama', 'Kapten') + '!'; }
async function mulai() {
  $('#login').hidden = true; $('#login video').pause(); $('#app').hidden = false;
  $('#sapa').textContent = sapaan(); $$('.tgl').forEach(el => aturTgl(el)); tampilMaster(); tampil(); buka('home', true);
  history.replaceState({s: 'home'}, '');
  if (!S.ring) kartu('Sedang Mengambil Data Awal…');
  const r = await api('awal', {}, 'Muat Data Awal');
  if (r.ok) { S.master = r.data.master; LS.set('master', S.master); tampilMaster(); if ($('#kartu').classList.contains('proses')) $('#kartu').hidden = true; terimaRing(r.data.ring); }
  else if (!S.tok) return;
  else kartuSelesai(false, r.net ? 'Sinyal Putus. Data Yang Tampil Dari Simpanan Terakhir.' : r.pesan);
  kirimQ();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
S.tok ? mulai() : tampilLogin();
