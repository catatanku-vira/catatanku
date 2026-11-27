// ===== CONFIG (hanya bagian ini yang diganti saat pasang) =====
const CONFIG = {
  API: 'PASTE_ALAMAT_EXEC_DI_SINI',
  CLIENT_ID: 'PASTE_GOOGLE_CLIENT_ID_DI_SINI',
  VERSI: '1.0'
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
        terimaRing(r.data.ring); hapusRiw(it.data.jenis || 'pengeluaran');
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
async function muatRing() { const r = await api('ringkasan', {}, 'Muat Ringkasan'); if (r.ok) terimaRing(r.data); }
function efektif() {
  const r = JSON.parse(JSON.stringify(S.ring || {stok: {}, min: {}, kasbon: [], terakhir: []}));
  for (const it of S.q) {
    const d = it.data;
    if (it.st === 'gagal' && !it.net) continue;
    if (it.aksi === 'simpan' && d.jenis === 'kresek') r.stok[d.ukuran] = (r.stok[d.ukuran] || 0) + (d.arah === 'masuk' ? d.pak : -d.pak);
    if (it.aksi === 'simpan' && d.jenis === 'pengeluaran' && d.status === 'belum') r.kasbon.unshift({id: it.id, waktu: it.t, toko: d.toko, desk: d.desk, nominal: d.nominal, sisa: d.nominal, ket: d.ket, pend: 1});
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
  if (r.kasbon.length) lap.push(h('button', {cls: 'row', onclick: () => buka('peng')}, img('jam'), h('span', {cls: 't'}, r.kasbon.length + ' Kasbon Belum Lunas')));
  if (S.q.some(x => x.st === 'gagal')) lap.push(h('button', {cls: 'row', onclick: () => buka('antrean')}, img('bell'), h('span', {cls: 't'}, 'Ada Catatan Gagal Terkirim')));
  isi($('#laporan'), lap.length ? lap : [h('div', {cls: 'row'}, img('lunas'), h('span', {cls: 't'}, 'Semua Aman, Kapten'))]);
  // catatan terakhir: yang di antrean dulu, lalu dari server
  const pend = S.q.slice().reverse().map(it => barisData(Object.assign({waktu: it.t}, it.data, it.aksi !== 'simpan' ? {jenis: 'bayar', nominal: it.data.jumlah, status: it.aksi === 'lunas' ? 'lunas' : ''} : {}), it.st === 'gagal' ? 'Gagal Terkirim' : 'Menunggu Kirim'));
  const ter = pend.concat((r.terakhir || []).map(x => barisData(x))).slice(0, 6);
  isi($('#terakhir'), ter.length ? ter : [h('div', {cls: 'kosong'}, 'Belum Ada Catatan Bulan Ini')]);
  // kasbon belum lunas
  $('#nBelum').textContent = r.kasbon.length;
  isi($('#pgBelum'), r.kasbon.length ? r.kasbon.map(kartuKasbon) : [h('div', {cls: 'card kosong'}, 'Tidak Ada Kasbon Belum Lunas')]);
  lencana();
}
function barisData(o, status) {
  let ik = 'struk', judul = '', nilai = o.nominal ? rp(o.nominal) : '';
  if (o.jenis === 'kresek') { ik = o.arah === 'masuk' ? 'masuk' : 'jual'; judul = (o.arah === 'masuk' ? 'Stok Masuk' : o.toko) + ' · Kresek ' + o.ukuran; nilai = ang(o.pak) + ' Pak'; }
  else if (o.jenis === 'pengeluaran') judul = o.toko + ' · ' + o.desk + (o.status === 'belum' ? ' (Belum Lunas)' : '');
  else if (o.jenis === 'bayar') { ik = 'lunas'; judul = (o.toko ? o.toko + ' · ' : '') + 'Bayar Kasbon' + (o.status === 'lunas' ? ' (Lunas)' : ''); }
  else { ik = 'buku'; judul = (o.sub || '') + ' · ' + o.desk; }
  return h('div', {cls: 'row'}, img(ik), h('div', {cls: 't'}, judul, h('small', {cls: status ? 'pend' : ''}, (status ? status + ' · ' : '') + wkt(o.waktu) + (o.ket ? ' · ' + o.ket : ''))), h('span', {cls: 'v'}, nilai));
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
  return h('div', {cls: 'card k'},
    h('div', {cls: 'h'}, h('span', {}, k.toko + ' · ' + k.desk), h('span', {}, ang(k.nominal))),
    h('div', {cls: 's'}, wkt(k.waktu) + ' · ' + (sudah ? 'Sudah Bayar ' + ang(sudah) + ' · ' : 'Belum Bayar · ') + 'Sisa ' + ang(k.sisa) + (k.pend ? ' · Menunggu Kirim' : '') + (k.ket ? ' · ' + k.ket : '')),
    h('div', {cls: 'bar'}, h('i', {style: 'width:' + Math.round(sudah / k.nominal * 100) + '%'})),
    h('div', {cls: 'b2'}, h('button', {onclick: () => { box.hidden = !box.hidden; if (!box.hidden) inp.focus(); }}, 'Bayar Sebagian'),
      h('button', {cls: 'ok', onclick: async () => { if (await tanya('Tandai Lunas?', k.toko + ' · ' + k.desk + ', sisa ' + rp(k.sisa) + ' dianggap lunas.', {ok: 'Lunas'})) { antre('lunas', {kasbonId: k.id}, 'Lunas ' + k.toko); kartuSelesai(true, 'Kasbon ' + k.toko + ' Lunas'); } }}, '✓ Lunas')),
    box);
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
['krToko', 'pgToko', 'pgJenis', 'krUkuran', 'pgStatus'].forEach(id => chipsPilih($('#' + id)));
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
  const stok = efektif().stok[ukuran] || 0;
  if (arah === 'jual' && pak > stok) return kartuSelesai(false, 'Stok Kresek ' + ukuran + ' Tinggal ' + stok + ' Pak');
  antre('simpan', {jenis: 'kresek', arah, ukuran, pak, toko: arah === 'jual' ? toko : ''}, (arah === 'masuk' ? 'Stok Masuk ' : 'Jual ') + ukuran);
  kartuSelesai(true, 'Tersimpan, Stok ' + ukuran + ' Jadi ' + (stok + (arah === 'masuk' ? pak : -pak)) + ' Pak');
  qty.value = '1';
});

// ---------- Pengeluaran ----------
sekali($('#pgSimpan'), () => {
  const toko = dipilih($('#pgToko')), desk = dipilih($('#pgJenis')), nominal = nilaiRp($('#pgNom')), status = dipilih($('#pgStatus'));
  if (!toko) return kartuSelesai(false, 'Pilih Toko Dulu');
  if (!desk) return kartuSelesai(false, 'Pilih Jenis Dulu');
  if (!nominal) return kartuSelesai(false, 'Isi Nominal Dulu');
  antre('simpan', {jenis: 'pengeluaran', toko, desk, nominal, status, ket: $('#pgKet').value.trim().slice(0, 120)}, 'Pengeluaran ' + toko);
  kartuSelesai(true, 'Tersimpan Di HP: ' + toko + ' · ' + desk + ' ' + rp(nominal));
  $('#pgNom').value = ''; $('#pgKet').value = '';
});
chipsPilih($('#pgTab'), v => { const riw = $('#s-peng .riw'); $('#pgBelum').hidden = v !== 'belum'; riw.hidden = v === 'belum'; if (v !== 'belum') muatRiwayat(riw, v); });

// ---------- Pribadi ----------
chipsPilih($('#prSub'), v => { $('#prNama').textContent = v; $('#prSimpan').textContent = 'Simpan Ke ' + v; muatRiwayat($('#s-prib .riw')); });
sekali($('#prSimpan'), () => {
  const sub = dipilih($('#prSub')), desk = $('#prDesk').value.trim(), nominal = nilaiRp($('#prNom'));
  if (!desk) return kartuSelesai(false, 'Isi Deskripsi Dulu');
  if (!nominal) return kartuSelesai(false, 'Isi Nominal Dulu');
  antre('simpan', {jenis: 'pribadi', sub, desk: desk.slice(0, 60), nominal}, 'Pribadi ' + sub);
  kartuSelesai(true, 'Tersimpan Di HP: ' + sub + ' · ' + desk + ' ' + rp(nominal));
  $('#prDesk').value = ''; $('#prNom').value = ''; muatRiwayat($('#s-prib .riw'));
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
    if (ym === ymNow()) { const tot = rows.reduce((a, x) => a + Number(x.nominal || 0), 0) + S.q.filter(x => x.data.jenis === 'pribadi' && x.data.sub === sub).reduce((a, x) => a + x.data.nominal, 0); $('#prTot').textContent = rp(tot); $('#prBln').textContent = bulanNama(ym); }
  }
  if (mode === 'lunas') rows = rows.filter(x => x.jenis === 'bayar' ? x.status === 'lunas' : x.status === 'lunas');
  const pend = S.q.filter(x => x.aksi === 'simpan' && x.data.jenis === jenis && ym === ymNow() && (jenis !== 'pribadi' || x.data.sub === dipilih($('#prSub')))).reverse().map(it => barisData(Object.assign({waktu: it.t}, it.data), it.st === 'gagal' ? 'Gagal Terkirim' : 'Menunggu Kirim'));
  const list = pend.concat(rows.slice(0, 300).map(x => barisData(x)));
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
function tampilLogin(pesan) {
  $('#app').hidden = true; $('#login').hidden = false; $('#lgPesan').textContent = pesan || '';
  $('#login video').play().catch(() => {});
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

// ---------- mulai ----------
function sapaan() { const j = +new Date().toLocaleString('en-US', {hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta'}); return (j < 11 ? 'Selamat Pagi' : j < 15 ? 'Selamat Siang' : j < 18 ? 'Selamat Sore' : 'Selamat Malam') + ', ' + LS.get('nama', 'Kapten') + '!'; }
async function mulai() {
  $('#login').hidden = true; $('#login video').pause(); $('#app').hidden = false;
  $('#sapa').textContent = sapaan(); tampilMaster(); tampil(); buka('home', true);
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
