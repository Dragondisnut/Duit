# KasKu: catatan keuangan offline

Aplikasi Android untuk mencatat pengeluaran cukup dengan mengetik seperti chat, misalnya
`ayam 1 kg 40k, telor 1 kg 28k`. Aplikasi otomatis:

- mencatat dan memasukkan tiap barang ke pos anggaran (Makan, Kas rumah, Tabungan, Laundry & lain, Motor)
- memindahkan dana dari pos yang masih longgar kalau ada pos yang jebol (tabungan dipakai paling terakhir)
- memberi peringatan kalau belanja lebih cepat dari jadwal, dan menghitung sisa aman per hari
- memberi ringkasan mingguan dan memberi tahu kalau harga barang naik

Aplikasi ini **tidak punya izin internet**. Semua data tersimpan hanya di HP.

## Perintah di kolom ketik

| Ketik | Fungsi |
|---|---|
| `ayam 1 kg 40k` | catat pengeluaran (boleh banyak sekaligus, pisahkan dengan koma atau "dan") |
| `honor aslab 400k` | catat pemasukan; target tabungan bulan ini ikut naik |
| `nabung 200k` | catat uang yang benar-benar ditabung |
| `ganti ke motor` | pindahkan catatan terakhir ke pos lain; aplikasi mengingatnya untuk ke depan |
| `batal` | hapus catatan terakhir |
| `sisa` | lihat sisa semua pos |
| `ringkasan` | ringkasan 7 hari terakhir |

## Tab Gizi (catat makan)

Ketik makanan beserta beratnya, misalnya `tempe rebus 30g, dada ayam 150g, telur 2 butir`. Aplikasi menghitung kalori, protein, lemak, karbohidrat, dan serat, lalu menampilkan lingkaran sisa kalori dan persentase tiap zat gizi terhadap target.

Database berisi sekitar **1.200 bahan**: seluruh TKPI (1.141 bahan) ditambah 45 bahan dari USDA yang tidak ada di TKPI.

| Ketik | Fungsi |
|---|---|
| `tempe rebus 30g` | catat makanan; satuan g, kg, ons |
| `telur 2` / `2 telur` / `putih telur 3` | per butir (berat per butir bisa diubah di pengaturan Gizi) |
| `minyak 1 sdm` | sdm untuk minyak, gula, madu, kecap, selai kacang, susu kental manis |
| `roti 2 lembar` | lembar untuk roti tawar dan roti gandum |
| `susu 250ml` | ml untuk susu, kopi, teh, santan, minyak |
| `cari ikan` | tampilkan bahan yang cocok; ketuk salah satu, lalu ketik beratnya |
| `t373 50g` | pilih bahan langsung dari kodenya (kode terlihat di hasil `cari`) |
| `kerupuk = 480 kkal, 5p, 20l, 68k, 1s` | tambah makanan sendiri (nilai per 100 g) |
| `sisa` / `batal` | lihat sisa hari ini / hapus catatan terakhir |

- Bahan mentah dicatat dengan **berat mentah**. Bahan bertanda **siap makan** (nasi, roti, masakan seperti soto atau rendang) ditimbang dalam bentuk siap makan.
- Kata cara masak (rebus, goreng, dll.) hanya jadi label, jadi `tahu goreng 100g` = 100 g tahu mentah. Minyak untuk menggoreng/menumis dicatat terpisah, mis. `minyak 1 sdm`. Kalau mau nilai versi matang dari TKPI, pakai `cari` lalu pilih yang bertanda siap makan.
- `ayam` tanpa keterangan = dada ayam fillet tanpa kulit. Kalau satu nama cocok dengan banyak bahan, aplikasi memilih versi mentah/segar dan memberi tahu ada pilihan lain.
- Sebagian bahan TKPI tidak punya data serat; serat bahan itu dihitung 0 dan aplikasi memberi tahu.
- Sumber: TKPI (Kemenkes, panganku.org; lewat dataset github.com/intanypurbasari/food-nutrition, MIT) dan USDA FoodData Central SR Legacy. Berat per sdm/lembar/butir dari porsi standar USDA. Sumber tiap bahan tercatat di `gizi_db.js`.

## Cara mendapatkan APK (build otomatis di GitHub)

1. Buat repository baru di github.com (boleh private), misalnya `kasku`.
2. Di laptop, ekstrak zip ini, lalu di halaman repo klik **Add file → Upload files** dan seret **seluruh isi** folder `kasku` (termasuk folder `.github`). Klik **Commit changes**.
   - Kalau folder `.github` tidak ikut terunggah: klik **Add file → Create new file**, beri nama `.github/workflows/build-apk.yml`, lalu tempel isi file `build-apk.yml` dari zip ini.
3. Buka tab **Actions**. Proses **Build APK** berjalan otomatis (sekitar 3–6 menit). Tunggu sampai centang hijau.
4. Klik proses tersebut. Di bagian **Artifacts**, unduh **KasKu-apk** (berbentuk zip berisi `app-debug.apk`).
5. Pindahkan `app-debug.apk` ke HP, buka, izinkan **instal dari sumber tidak dikenal**, lalu instal.

Kalau build gagal (silang merah), buka log-nya, salin pesan error-nya, dan kirim ke Claude untuk diperbaiki.

## Backup

Pengaturan (ikon kanan atas) → **Simpan backup** menyimpan file ke `Download/KasKu/`.
Simpan backup sebelum uninstall atau ganti HP; pulihkan lewat **Pulihkan backup**.
