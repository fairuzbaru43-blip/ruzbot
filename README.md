# RuzBot

RuzBot menyediakan dashboard web privat untuk menautkan hingga lima akun WhatsApp dengan QR seperti WhatsApp Web. Frontend dapat di-host sebagai situs statis (misalnya Vercel); backend Node.js dan Chrome harus berjalan terus di host terpisah dengan penyimpanan persisten.

Library ini bukan WhatsApp Business Cloud API resmi Meta. Ia mengendalikan sesi WhatsApp Web, sehingga kompatibilitas dapat berubah saat WhatsApp Web diperbarui atau sesi perlu ditautkan ulang. Untuk layanan bisnis yang butuh dukungan API resmi, gunakan arsitektur Cloud API terpisah.

## Status tahap

| Tahap | Status | Catatan |
|---|---|---|
| 1. Analisis dan arsitektur | Selesai | Pairing QR melalui WhatsApp Web dengan sesi lokal persisten. |
| 2. Proyek dan koneksi | Dashboard siap diuji | QR tampil di dashboard setelah login; pairing nyata perlu dipindai dari ponsel. |
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
│   ├── web/             # server dashboard dan API privat
│   ├── handlers/        # parsing dan dispatcher
│   ├── commands/        # registry dan command dasar
│   ├── services/        # pemrosesan pesan masuk
│   ├── database/        # JSON store profil/sesi lokal
│   ├── middleware/      # izin dan batas penggunaan
│   └── utils/           # validasi input
├── tests/
├── public/              # frontend dashboard statis
├── data/                # file lokal, diabaikan Git
├── Dockerfile           # backend + Chromium untuk host persisten
├── vercel.json          # build website statis saja
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Pasang di Windows 11 dengan VS Code dan PowerShell

### 1. Persyaratan

- Node.js LTS 22.12+ atau 24+, VS Code, dan koneksi internet untuk pemasangan paket serta Chromium.
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

Paket `whatsapp-web.js` memakai Puppeteer untuk menjalankan Chrome/Chromium. Di Windows, RuzBot otomatis mencari Chrome di lokasi umum; set `CHROME_EXECUTABLE_PATH` jika dipasang di lokasi lain.

### 4. Konfigurasi

```powershell
Copy-Item .env.example .env
```

Pairing QR tidak memerlukan access token, App Secret, Phone Number ID, atau webhook. Setelah menyalin `.env.example`, buka `.env` dan isi `DASHBOARD_PASSWORD` dengan kata sandi acak minimal 12 karakter. Untuk pemakaian lokal, biarkan `FRONTEND_ORIGIN` kosong.

Sesi perangkat disimpan di `.wwebjs_auth/`, sedangkan daftar nama akun disimpan di `data/whatsapp-accounts.json`. Keduanya bersifat privat dan diabaikan Git. Jangan unggah atau bagikan folder `.wwebjs_auth/`.

### 5–6. Jalankan dan tautkan WhatsApp

Mode development dengan restart saat kode berubah:

```powershell
npm.cmd run dev
```

Atau mode normal:

```powershell
npm.cmd start
```

Buka `http://localhost:3000`, login dengan `DASHBOARD_PASSWORD`, lalu tambahkan akun. Pindai QR pada halaman melalui **WhatsApp → Perangkat tertaut → Tautkan perangkat**. Setiap akun memiliki sesi sendiri dan akan tersambung kembali saat backend dijalankan ulang. `Ctrl+C` menghentikan dashboard dan browser.

Mode `dev` dan `start` sama-sama menggunakan satu proses backend; jangan jalankan dua salinan sekaligus pada direktori sesi yang sama. Backend menyediakan `GET /api/health` untuk pengecekan layanan.

### 7–8. Uji dan tangani error

```powershell
npm.cmd test
npm.cmd run check
```

Setelah pairing siap, kirim `!ping`, `!help`, `!help ping`, atau `!status` ke akun WhatsApp yang ditautkan. Error umum:

- **Dashboard meminta password:** pastikan `DASHBOARD_PASSWORD` sudah diisi di `.env`, lalu mulai ulang server.
- **QR tidak muncul:** tunggu Chrome mulai dan periksa log backend; pastikan `npm.cmd install` selesai tanpa error.
- **Chrome tidak ditemukan:** pastikan Google Chrome terpasang. Jika lokasinya khusus, set `CHROME_EXECUTABLE_PATH` di `.env` ke file `chrome.exe`, lalu jalankan ulang.
- **Frontend Vercel tidak tersambung ke API:** masukkan URL HTTPS backend di kolom **Alamat backend** dan pastikan `FRONTEND_ORIGIN` pada backend sama persis dengan origin situs Vercel.
- **Port 3000 terpakai:** hentikan proses RuzBot lama atau ubah `PORT` di `.env`.
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

### 10. Website Vercel dan backend

Vercel hanya men-deploy frontend statis dari `public/`; proses Chrome/WhatsApp tidak berjalan di Vercel. Backend tetap memerlukan Node.js, Chrome, URL HTTPS publik, dan disk persisten. Di VPS yang mendukung Docker Compose, siapkan `.env` backend lalu jalankan:

```powershell
docker compose up -d --build
docker compose logs -f
```

Compose memakai volume persisten untuk `/app/data` dan `/app/.wwebjs_auth`. Atur `DASHBOARD_PASSWORD` dan `FRONTEND_ORIGIN=https://ruzbot.vercel.app` di `.env` backend atau environment variables privat milik host; jangan masukkan rahasia ke frontend/Vercel. Arahkan domain HTTPS ke port `3000`. Jangan menghapus named volumes saat memperbarui container, atau sesi WhatsApp bisa hilang.

Deploy repository yang sama ke Vercel. Konfigurasi `vercel.json` men-deploy `public/` saja dan melewati skrip unduh Chromium. Setelah situs aktif, buka dan masukkan URL HTTPS backend pada kolom **Alamat backend**, lalu login menggunakan `DASHBOARD_PASSWORD`.

VPS free-tier bisa memiliki kuota, antrean kapasitas, waktu tidur, atau penyimpanan sementara. Jika host tidur atau menghapus disk, bot akan terputus atau perlu ditautkan ulang. Periksa syarat host dan pastikan penyimpanan persisten tersedia sebelum memasangkan akun utama.

## Keamanan dan batasan

- `.env`, daftar akun, dan sesi WhatsApp diabaikan Git. Jangan pernah mengunggah `.wwebjs_auth/`; orang yang memperoleh sesi dapat memakai akun tertaut.
- Dashboard dilindungi kata sandi dan token admin sementara yang hanya disimpan per-tab di browser; gunakan HTTPS jika diakses lewat internet. QR yang tampil pada panel adalah kredensial sementara—jangan bagikan.
- QR pairing web tersedia pada rilis ini; pairing dengan kode angka belum didukung. Dashboard privat ini mengelola beberapa akun dari satu admin, bukan layanan multi-user dengan akun login terpisah.
- Handler bot tidak mencatat isi chat ke database. Namun profil Chromium di `.wwebjs_auth/` menyimpan sesi dan dapat menyimpan cache WhatsApp Web; lindungi folder itu, batasi akses komputer, dan hapus sesi/revoke perangkat saat tidak dipakai.
- Masukan teks dibatasi 4.096 karakter dan perintah dibatasi 20 per pengirim per menit. Utilitas batas AI (5/jam) dan unduhan (3/jam) belum mengaktifkan fitur tersebut.
- Belum ada command admin/owner, grup, AI, downloader, media, musik, anime, pencarian, NSFW, pengiriman massal, OTP, atau pengambilan akun.
- Link sumber library: [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js), [panduan autentikasi LocalAuth](https://wwebjs.dev/guide/creating-your-bot/authentication.html).

## Testing

```powershell
npm.cmd test
npm.cmd run check
```

Tes mencakup parsing/prefix/alias, registry menu, izin, penanganan error, rate limit, penyimpanan data, validasi input, LocalAuth/Chromium melalui mock, manajemen beberapa sesi, login dashboard, CORS, dan QR melalui mock. Tes tidak memerlukan akun atau kredensial WhatsApp. Pairing nyata harus diuji dengan memindai QR dari halaman dashboard.
