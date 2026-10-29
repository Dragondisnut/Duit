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
