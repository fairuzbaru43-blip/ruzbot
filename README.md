# RuzBot

RuzBot sekarang menghubungkan WhatsApp dengan gaya WhatsApp Web: jalankan program, pindai QR dari WhatsApp di ponsel, lalu sesi lokal dipakai lagi saat bot dijalankan ulang. Koneksi dibuat memakai `whatsapp-web.js`, Puppeteer, dan `LocalAuth`.

Library ini bukan WhatsApp Business Cloud API resmi Meta. Ia mengendalikan sesi WhatsApp Web, sehingga kompatibilitas dapat berubah saat WhatsApp Web diperbarui atau sesi perlu ditautkan ulang. Untuk layanan bisnis yang butuh dukungan API resmi, gunakan arsitektur Cloud API terpisah.

## Status tahap

| Tahap | Status | Catatan |
|---|---|---|
| 1. Analisis dan arsitektur | Selesai | Pairing QR melalui WhatsApp Web dengan sesi lokal persisten. |
| 2. Proyek dan koneksi | Implementasi siap diuji | QR tampil saat program dijalankan; pairing nyata perlu dipindai dari ponsel. |
| 3. Handler, registry, menu | Selesai | `!help [nama]` mencari perintah dan memberi deskripsi dari registry. |
| 4. Perintah dasar, konfigurasi, data | Fondasi selesai | `ping`, `help`, `status`, konfigurasi `.env`, izin, dan JSON store lokal. |
| 5. AI | Belum dikonfigurasi | Tidak ada penyedia/model dan perintah AI aktif. |
| 6. Tools tanpa API | Parsial | Validasi input dan batas penggunaan tersedia; belum semua menjadi command. |
| 7. Game dan profil | Tertunda | Store sesi/profil ada, gameplay belum dibuat. |
| 8. Pengelolaan grup | Tertunda | Command grup belum dibuat. Command aktif hanya untuk chat pribadi. |
| 9. Downloader, anime, pencarian, musik | Belum dikonfigurasi | Fitur-fitur ini tetap nonaktif sampai provider dipilih dan diuji. |
| 10. Tes, keamanan, dokumentasi | Fondasi selesai | Tes memakai mock dan tidak butuh akun WhatsApp. |

## Perintah aktif

| Nama | Alias | Kategori | Deskripsi | Handler | Izin | Konteks | Ketergantungan | Status |
|---|---|---|---|---|---|---|---|---|
| `help` | `menu`, `bantuan` | bot | Cari perintah atau tampilkan daftar. | `core.help` | pengguna | pribadi | Sesi WhatsApp tertaut untuk membalas | aktif |
| `ping` | `p` | bot | Periksa pemrosesan pesan. | `core.ping` | pengguna | pribadi | Sesi WhatsApp tertaut untuk membalas | aktif |
| `status` | — | bot | Lihat status sesi dan integrasi. | `core.status` | pengguna | pribadi | Sesi WhatsApp tertaut untuk membalas | aktif |

Perintah bantuan dan ping bisa diuji dengan tes otomatis tanpa menghubungkan WhatsApp. Setelah sesi tertaut, bot memproses pesan masuk melalui event client. Pesan grup tidak menjalankan command yang hanya mengizinkan konteks pribadi.

## Struktur

```text
ruzbot/
├── src/
│   ├── index.js
│   ├── config/          # .env dan pengaturan client
│   ├── whatsapp/        # client WhatsApp Web, QR, dan LocalAuth
│   ├── handlers/        # parsing dan dispatcher
│   ├── commands/        # registry dan command dasar
│   ├── services/        # pemrosesan pesan masuk
│   ├── database/        # JSON store profil/sesi lokal
│   ├── middleware/      # izin dan batas penggunaan
│   └── utils/           # validasi input
├── tests/
├── data/                # file lokal, diabaikan Git
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Pasang di Windows 11 dengan VS Code dan PowerShell

### 1. Persyaratan

- Node.js LTS 22.12+ atau 24+, VS Code, dan koneksi internet untuk pemasangan paket serta Chromium Puppeteer.
- `npm` ikut terpasang bersama Node.js. Jika PowerShell memblokir `npm.ps1`, gunakan `npm.cmd` seperti di contoh berikut.

Periksa versi:

```powershell
node --version
npm.cmd --version
```

### 2–3. Buka proyek dan pasang paket

Buka folder proyek di VS Code, lalu di terminal PowerShell:

```powershell
Set-Location "C:\path\ke\ruzbot"
npm.cmd install
```

Paket `whatsapp-web.js` memakai Puppeteer untuk menjalankan Chromium. Instalasi awal dapat mengunduh Chromium dan memerlukan ruang serta waktu tambahan.

### 4. Konfigurasi

```powershell
Copy-Item .env.example .env
```

Pairing QR tidak memerlukan access token, App Secret, Phone Number ID, atau webhook. `.env` hanya mengatur prefix, ID sesi, lokasi sesi, dan opsi Chrome. Jika `CHROME_EXECUTABLE_PATH` kosong, Windows otomatis mencari Google Chrome di lokasi instalasi umum; platform lain memakai Chromium yang dikelola Puppeteer. Isi path Chrome/Chromium sendiri hanya jika Chrome terpasang di lokasi khusus.

Sesi disimpan di `.wwebjs_auth/`. Folder ini adalah kredensial perangkat tertaut, jangan unggah atau bagikan. `.gitignore` sudah mengabaikannya.

### 5–6. Jalankan dan tautkan WhatsApp

Mode development dengan restart saat kode berubah:

```powershell
npm.cmd run dev
```

Atau mode normal:

```powershell
npm.cmd start
```

QR akan muncul di terminal. Pada ponsel, buka **WhatsApp → Perangkat tertaut → Tautkan perangkat**, lalu pindai QR tersebut. Tunggu sampai terminal menampilkan `RuzBot terhubung ke WhatsApp Web.` Biarkan proses tetap berjalan. `Ctrl+C` menghentikan bot. Jika sesi tersimpan, proses berikutnya biasanya tersambung tanpa QR baru.

Mode `dev` dan `start` sama-sama menggunakan satu proses browser; hentikan proses lama dengan `Ctrl+C` sebelum menjalankan mode lainnya. Bot ini tidak menyediakan halaman web atau endpoint `/health`.

### 7–8. Uji dan tangani error

```powershell
npm.cmd test
npm.cmd run check
```

Setelah pairing siap, kirim `!ping`, `!help`, `!help ping`, atau `!status` ke akun WhatsApp yang ditautkan. Error umum:

- **QR tidak muncul:** tunggu Chromium mulai; pastikan `npm.cmd install` selesai tanpa error.
- **Chrome tidak ditemukan:** pastikan Google Chrome terpasang. Jika lokasinya khusus, set `CHROME_EXECUTABLE_PATH` di `.env` ke file `chrome.exe`, lalu jalankan ulang.
- **Sesi ditolak atau rusak:** hentikan bot, hapus hanya folder `.wwebjs_auth`, jalankan ulang, lalu pindai QR baru. Menghapus folder sesi memutus tautan lokal yang tersimpan.
- **Port 3000 terpakai:** bot versi QR tidak membuka server HTTP; pastikan tidak ada proses lama RuzBot yang masih berjalan jika ada error port dari proses lain.
- **PowerShell menolak `npm`:** gunakan `npm.cmd`.

### 9. Simpan ke GitHub dengan aman

```powershell
git init
git add .
git status
```

Pastikan `.env`, `.wwebjs_auth/`, `node_modules/`, dan data lokal tidak masuk ke daftar berkas yang akan diunggah. Setelah meninjau, commit dan push:

```powershell
git commit -m "Initialize RuzBot QR pairing"
git branch -M main
git remote add origin https://github.com/USER/ruzbot.git
git push -u origin main
```

Jika folder sesi atau rahasia terlanjur ter-commit, hapus dari riwayat Git dan tautkan ulang perangkat; menghapus berkas di commit terbaru saja tidak menghapus riwayat lama.

### 10. Menjalankan lokal atau server

- **Lokal:** dapat dicoba tanpa biaya hosting. Komputer, internet, dan proses Node harus tetap berjalan selama bot dipakai.
- **VPS:** butuh proses yang terus hidup, Chromium kompatibel, dan disk persisten untuk `.wwebjs_auth/`. Pastikan kebijakan host mengizinkan Chromium dan pemakaian browser otomatis. Free tier bisa sleep atau membatasi CPU, disk, serta waktu aktif.
- **Serverless/webhook:** tidak sesuai dengan implementasi client browser persisten ini. Tidak ada webhook HTTPS yang perlu dipublikasikan.
- **24 jam:** hanya jika host, koneksi, penyimpanan sesi, dan prosesnya mendukung uptime berkelanjutan. Tidak dijamin oleh mode lokal.

## Keamanan dan batasan

- `.env` dan sesi WhatsApp lokal diabaikan Git. Jangan pernah mengunggah `.wwebjs_auth/`; orang yang memperoleh sesi dapat memakai akun tertaut.
- Handler bot tidak mencatat isi chat ke database. Namun profil Chromium di `.wwebjs_auth/` menyimpan sesi dan dapat menyimpan cache WhatsApp Web; lindungi folder itu, batasi akses komputer, dan hapus sesi/revoke perangkat saat tidak dipakai.
- Masukan teks dibatasi 4.096 karakter dan perintah dibatasi 20 per pengirim per menit. Utilitas batas AI (5/jam) dan unduhan (3/jam) belum mengaktifkan fitur tersebut.
- Belum ada command admin/owner, grup, AI, downloader, media, musik, anime, pencarian, NSFW, pengiriman massal, OTP, atau pengambilan akun.
- Link sumber library: [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js), [panduan autentikasi LocalAuth](https://wwebjs.dev/guide/creating-your-bot/authentication.html).

## Testing

```powershell
npm.cmd test
npm.cmd run check
```

Tes mencakup parsing/prefix/alias, registry menu, izin, penanganan error, rate limit, store profil/sesi, validasi input, LocalAuth/Chromium melalui mock, alur event QR, pesan duplikat, dan pembatasan konteks grup. Tes tidak memerlukan akun atau kredensial WhatsApp. Pairing sungguhan baru terverifikasi setelah QR dipindai dan terminal menunjukkan status terhubung.
