# SELA Smart QR Menu — Rencana Pengerjaan dalam Prompt Bertahap

Disusun: 28 Oktober 2026. Bahasa kerja: Indonesia. Target penggunaan: AI coding agent di repository proyek, termasuk Google Antigravity.

Dokumen ini berisi instruksi yang dapat disalin satu per satu untuk membangun proyek dari fondasi sampai rilis dan serah terima. Ini merupakan rencana eksekusi; belum ada aplikasi, pengujian aplikasi, akun layanan, atau deployment yang dikerjakan melalui dokumen ini.

## Cara menggunakan

1. Tempatkan sembilan dokumen sumber di repository. Nama berakhiran `(1)` boleh tetap dipakai sampai Prompt 01 membuat pemetaan lokasi kanonis.
2. Kirim **Prompt 00** pada awal percakapan dengan coding agent.
3. Kirim **Prompt 01**, lalu lanjutkan sesuai urutan. Satu prompt menghasilkan satu tahap kerja yang dapat diperiksa. Jangan meminta seluruh tahap diimplementasikan sekaligus.
4. Lanjutkan setelah kriteria selesai tahap sebelumnya terpenuhi. Agent boleh memperbaiki kegagalan rutin dalam tahap yang sama tanpa meminta izin ulang.
5. Jika berpindah percakapan, kirim Prompt 00 dan prompt pemulihan konteks di bagian akhir, kemudian prompt tahap berikutnya.
6. Isi informasi produksi hanya ketika dibutuhkan. Masukkan secret melalui pengaturan environment atau secret manager; jangan menempelkannya pada prompt, dokumentasi, atau laporan.

Prasyarat yang belum tersedia tidak boleh disamarkan menjadi keberhasilan. Gunakan status `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN`, disertai alasan dan bukti. Kode yang selesai di sandbox masih perlu pemeriksaan operasional sebelum menerima pembayaran nyata.

## Dokumen yang digunakan

| Lampiran | Fungsi dalam rencana |
|---|---|
| `project-context(1).md` | Keputusan terbaru, identitas SELA, kuis tiga langkah, serta keputusan DEC-010 sampai DEC-015. |
| `agent(1).md` | Protokol kerja, batas scope, invarian, konvensi, pengujian, dan pelaporan. |
| `PRD(1).md` | Kebutuhan produk, aturan bisnis, 17 skenario UAT, dan standar penerimaan rilis. |
| `TRD(1).md` | Riwayat kebutuhan teknis, integrasi, keputusan lama, dan dependensi pihak kafe. |
| `techstack(1).md` | Baseline teknologi, environment, dependency, dan infrastruktur yang harus diverifikasi ulang. |
| `architecture(1).md` | ERD, kontrak API, alur pembayaran, privasi pesanan, dan integritas transaksi. |
| `design(1).md` | Token SELA, layar pelanggan/staf, aksesibilitas, dan pola cetak. |
| `visual-direction(1).md` | Isinya identik dengan `design(1).md`; perlakukan sebagai referensi pendamping. |
| `skils(1).md` | Katalog enam prosedur proyek; keberadaan berkas skill sesungguhnya tetap harus diperiksa. |

Proposal `.docx`, HTML di `design-preview/`, dan enam berkas `.agents/skills/*/SKILL.md` dirujuk oleh dokumen, tetapi tidak disertakan dalam lampiran ini. Rencana tidak menganggap isi maupun keberadaannya sudah diverifikasi.

## Konflik dan celah yang perlu dibereskan lebih dahulu

| Temuan | Penanganan yang dimasukkan ke prompt |
|---|---|
| Nama SELA, Cravia, Cravio, dan Kala Senja tercampur. | Gunakan SELA berdasarkan register terbaru. Tandai nama lain sebagai konten lama; jangan memakai alamat/kontak contoh sebagai data asli. |
| Kuis tiga langkah berhadapan dengan empat langkah. | Baseline terbaru: Suasana → Rasa → Format/Suhu. Kategori tetap filter katalog. |
| DEC-001–DEC-005 berbeda makna antara register lama dan terbaru. | Buat pemetaan berdasarkan dokumen, judul, dan makna. Jangan merujuk nomor DEC tanpa judul. |
| Nomor REQ di desain berbeda makna dari PRD; ada REQ tambahan. | Pertahankan ID PRD, buat alias untuk ID desain, dan tambahkan ID baru secara eksplisit untuk fitur yang belum punya padanan. |
| Bobot rekomendasi, tie-break, ambang skor, dan jumlah hasil berbeda. | Tetapkan kontrak rekomendasi sebelum menulis engine; jangan mencampur dua rumus. |
| PRD lama masih memperlihatkan pesanan tunai belum lunas di KDS. | DEC-013 berlaku: KDS hanya menerima pesanan lunas; antrean tunai terpisah di POS. |
| Ada klaim otomatis batal hanya karena webhook belum diterima. | Periksa status gateway; keterlambatan notifikasi tidak membuktikan transaksi belum dibayar. |
| Desain menghentikan polling ketika timer habis. | Timer mengatur tampilan. Server tetap melakukan rekonsiliasi agar settlement terlambat tidak hilang. |
| `orderSecretToken` belum dimodelkan jelas dalam ERD. | Tambahkan kontrak kepemilikan, penyimpanan hash token, dan perlindungan seluruh akses pesanan. |
| Harga berubah harus dideteksi, tetapi client dilarang mengirim total harga. | Gunakan quote/version dari server untuk persetujuan harga. |
| Auth admin berbeda: PIN atau username/password. | Catat sebagai keputusan terbuka, dengan usulan password admin dan PIN staf; jangan mengklaim sudah disepakati. |
| Catatan 100 vs 120 karakter; ukuran teks KDS juga berbeda. | Baseline 100 karakter; nomor meja ≥28px, item ≥18px, tombol KDS ≥56px. |
| Dua route group sama-sama mengklaim `/`; ada banyak alias route. | Buat satu route map. Usulan: `/` B2B dan `/order?table=XX` pintu pelanggan. |
| Investasi Rp750.000 berhadapan dengan paket B2B Rp2.500.000. | Bedakan biaya kontrak proyek dan harga penawaran B2B; angka publik perlu keputusan pemilik. |
| Stok biner, laporan harian, audit, kuis dinamis, dan pengaturan pajak tersebar di dokumen. | Masukkan semuanya ke traceability matrix; jangan menghilangkan fitur karena tidak ada di ERD awal. |
| Label Gantt `done` dan dokumen “production ready” tanpa bukti kode. | Status implementasi ditentukan dari repository dan hasil pemeriksaan aktual. |

### Koreksi infrastruktur yang terverifikasi

Pemeriksaan dokumentasi resmi pada 28 Oktober 2026 menunjukkan:

- Vercel Hobby ditujukan untuk personal/nonkomersial. Operasional pemesanan kafe perlu paket/hosting yang mengizinkan penggunaan komersial. Jangan menjanjikan biaya hosting produksi Rp0 berdasarkan asumsi lama. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- Node.js 20 tercantum sebagai EOL. Pilih runtime LTS yang masih didukung dan kompatibel dengan dependency terpilih; jangan menyalin Node 20.18.0 dari dokumen lama. [Node.js EOL](https://nodejs.org/en/about/eol)
- Backup harian terkelola Supabase didokumentasikan untuk paket Pro, Team, dan Enterprise; proyek free disarankan mengekspor data dan memiliki backup terpisah. Pastikan backup dapat dipulihkan pada paket yang benar-benar dipilih. [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- Panduan Midtrans GoPay/QRIS menyebut pemrosesan expiry dapat mengalami keterlambatan. Target bisnis 15 menit harus diterapkan bersama status gateway, rekonsiliasi, dan penanganan race condition. Verifikasi detail acquirer QRIS yang digunakan. [Midtrans expiry](https://docs.midtrans.com/docs/gopay-qris-pos-integration)

Semua versi, harga, batas kuota, dan kemampuan layanan harus dicek kembali ketika tahap terkait dijalankan.

## Urutan dan ketergantungan

| Prompt | Tahap | Hasil utama | Prasyarat |
|---|---|---|---|
| 00 | Instruksi induk | Kontrak kerja agent | Dokumen tersedia |
| 01 | Audit dan sinkronisasi | Baseline kebutuhan konsisten | 00 |
| 02 | Keputusan teknis | ADR, route map, kontrak status | 01 |
| 03 | Inisialisasi | Aplikasi dapat build, tooling dan CI dasar | 02 |
| 04 | Database | Schema, migration, seed, constraint | 03 |
| 05 | Auth dan otorisasi | Login staf dan proteksi server | 04 |
| 06 | Sistem desain | Komponen dan layout SELA | 03 |
| 07 | Meja dan katalog | Menu nyata dari database | 04, 06 |
| 08 | Kuis dan rekomendasi | Engine deterministik dan UI | 07, keputusan scoring |
| 09 | Keranjang dan quote | Modifier dan persetujuan harga | 07 |
| 10 | Order service | Pesanan atomik dan idempoten | 05, 09 |
| 11 | Charge QRIS | Midtrans sandbox terhubung | 10 |
| 12 | Webhook dan rekonsiliasi | Pembayaran konsisten dan expiry aman | 11 |
| 13 | Kasir POS | Konfirmasi tunai dan pembatalan | 05, 10, 12 |
| 14 | Real-time | Sinkronisasi aman lintas instance | 12, 13 |
| 15 | KDS dan tracker | Operasional dapur dan progres pelanggan | 14 |
| 16 | Struk dan cetak | E-receipt serta thermal 58/80mm | 13, 15 |
| 17 | Admin katalog | CRUD, upload, modifier, stok | 05, 07 |
| 18 | Konfigurasi dan laporan | Kuis dinamis, pajak, omzet, audit | 08, 12, 17 |
| 19 | QR meja | Master QR satuan dan massal | 17, domain final untuk master live |
| 20 | Landing B2B | Demo terisolasi dan CTA | 06, 08, keputusan harga |
| 21 | Audit kualitas | Keamanan, performa, aksesibilitas | 05–20 |
| 22 | UAT lengkap | Bukti uji seluruh kebutuhan | 21 |
| 23 | Operasional dan staging | CI/CD, monitoring, backup/restore | 22 |
| 24 | Rilis produksi | Deployment terverifikasi | 23 dan semua gate live |
| 25 | Serah terima | SOP, pelatihan, pemantauan awal | 24 |

Urutan ini sengaja menempatkan perlindungan transaksi dan auth sebelum dashboard operasional dinyatakan selesai. Sprint tujuh hari dalam sumber merupakan target pengerjaan awal. Jangan menyingkat quality gate demi mengejar tanggal; pengujian fisik, KYC, domain, dan kesiapan operasional menentukan kelayakan rilis live.

---

## Prompt 00 — Instruksi induk, kirim pada awal sesi

```text
Bertindak sebagai technical lead dan fullstack engineer untuk SELA Smart QR Menu. Bangun sistem satu kafe dalam modular monolith Next.js App Router + TypeScript strict + PostgreSQL + Prisma, dengan Midtrans Core API QRIS, pembayaran tunai, POS, KDS, admin, dan landing B2B.

Baca dokumen aktual: project-context, agent, PRD, TRD, techstack, architecture, design, visual-direction, dan skils. Temukan lokasi sebenarnya; suffix (1) dan perbedaan kapitalisasi jangan dianggap sebagai dokumen baru. Jangan mengaku membaca file yang tidak tersedia.

Aturan tetap:
1. Gunakan keputusan terbaru yang sudah diselaraskan. Sebelum ada baseline hasil audit, jangan mengatasi konflik secara diam-diam.
2. SELA; kuis tiga langkah Suasana/Rasa/Format; kategori Semua/Kopi/Non-Kopi/Makanan; stok biner; rekomendasi deterministik tanpa AI/LLM.
3. Harga resmi, modifier, dan total dihitung server dalam integer rupiah. Pajak/service default 0%. Snapshot transaksi tidak berubah ketika katalog diedit.
4. KDS hanya menerima pembayaran PAID. Tunai menunggu kasir. QRIS diverifikasi gateway, tanpa upload bukti manual. Target masa bayar 15 menit dengan rekonsiliasi server.
5. QR meja bersifat publik. Semua akses pesanan, pembayaran, tracker, receipt, dan stream harus membuktikan kepemilikan atau role staf yang berhak.
6. Checkout, charge, cash confirmation, dan webhook harus idempoten pada database. Jangan mengandalkan debounce atau memori proses.
7. Tidak ada role switcher publik, secret di client/log/git, impor design-preview ke src, atau fitur multi-tenant, loyalty, split bill, inventori bahan baku, dan automated refund gateway.
8. Gunakan token desain SELA, Bahasa Indonesia, Rp28.000, WIB. Target sentuh mobile ≥44px dan KDS ≥56px. Cetak baseline melalui dialog browser, tanpa klaim universal hardware atau silent print.
9. Periksa git status; pertahankan pekerjaan pengguna. Jangan reset, menghapus data aktif, mengubah konfigurasi global, membeli layanan, atau menggunakan uang nyata tanpa instruksi yang mencakup tindakan tersebut.
10. Baca skill proyek yang benar-benar tersedia ketika relevan. skils.md adalah indeks, bukan bukti keenam skill sudah terpasang. Jangan memasang skill atau plugin baru sebagai efek samping.

Kerjakan hanya tahap yang saya kirim berikutnya sampai implementasi dan verifikasinya selesai. Atasi bug rutin dalam scope secara mandiri. Jika prasyarat eksternal belum tersedia, selesaikan bagian independen dan laporkan blocker yang spesifik.

Setiap tahap:
- Sebutkan tujuan, kebutuhan beserta judulnya, dan rencana perubahan terbatas.
- Implementasikan perubahan, jalankan pemeriksaan relevan, lalu perbarui dokumentasi.
- Perbarui docs/implementation-progress.md: tahap, commit jika ada, file berubah, pemeriksaan aktual, blocker, dan langkah berikutnya. Jangan simpan secret atau token pesanan di sana.
- Laporkan hasil dalam Bahasa Indonesia: apa berubah; alasan; command dan hasil nyata; kriteria PASS/FAIL/BLOCKED/NOT RUN; risiko tersisa; tahap berikutnya.
- Jangan mengarang log, screenshot, hasil test, atau status production ready. Jangan otomatis menjalankan tahap berikutnya di luar prompt yang sedang diberikan.
```

## Prompt 01 — Audit sembilan dokumen dan tetapkan baseline

```text
Jalankan tahap audit sebelum coding aplikasi. Terapkan instruksi induk.

Inventarisasi sembilan .md sumber, repository, prototipe, proposal, dan skill yang benar-benar tersedia. Baca seluruh dokumen tersedia. Bedakan rencana dokumen dengan implementasi aktual.

Buat pemetaan file sumber ke lokasi kanonis. Usulan: agent.md, PRD.md, TRD.md, techstack.md, architecture.md, design.md, visual-direction.md, skils.md, dan docs/project-context.md. Pertahankan sumber asli. Jangan menimpa dokumen berbeda hanya karena namanya mirip. Untuk duplikasi design/visual-direction, pilih satu acuan visual dan jadikan lainnya penunjuk jika sesuai.

Buat docs/spec-audit.md dan docs/requirements-traceability.md. Matriks harus memetakan sumber + ID asli + judul kebutuhan → ID kanonis → layar/API/data → acceptance criteria → bukti uji. Nomor DEC/REQ yang bentrok tidak boleh ditimpa atau diganti maknanya tanpa catatan alias.

Audit setidaknya: nama merek; kuis 3/4 langkah; rumus rekomendasi; kitchen gate; state enum; route yang bertabrakan; akses admin PIN/password; catatan 100/120 karakter; harga B2B/kontrak; token pesanan; quote perubahan harga; asumsi Vercel Hobby/Node20/backup free; jadwal yang sudah diberi label done tanpa bukti.

Terapkan keputusan jelas yang terbaru seperti SELA, kuis tiga langkah, dan PAID-only KDS. Tandai konflik yang belum punya dasar sebagai OPEN; pisahkan usulan dari keputusan terkonfirmasi. Jangan membuat data kontak, harga publik, atau persetujuan bisnis baru.

Kriteria selesai: setiap kebutuhan dari semua sumber terlacak, setiap konflik punya resolusi berdasar atau owner keputusan, dan lokasi dokumen konsisten. Belum perlu scaffolding aplikasi.
```

## Prompt 02 — Putuskan arsitektur implementasi dan kontrak

```text
Gunakan hasil audit untuk membuat ADR dan kontrak sebelum scaffold. Pertahankan modular monolith; jangan menambah infrastruktur yang tidak dibutuhkan.

Verifikasi dokumentasi resmi terbaru untuk kompatibilitas dan dukungan Node, Next.js, React, Prisma, Tailwind, driver DB, auth, dan library uji. Baseline sumber adalah Next.js 15, bukan izin memakai patch lama atau create-next-app@latest tanpa pemeriksaan. Pilih patch yang aman dan didukung. Jika major baseline sudah tidak layak, ajukan perubahan terfokus dengan bukti sebelum menggantinya. Gunakan runtime LTS yang masih didukung.

Tetapkan ADR untuk:
1. Satu provider PostgreSQL, object storage, dan mekanisme real-time utama yang dapat berjalan pada hosting terpilih. Verifikasi paket komersial, durasi function, pooling, reconnect, scheduler, backup, dan biaya. Jangan menganggap Vercel Hobby cocok untuk kafe.
2. Integrasi auth cookie staf dengan real-time. Cookie custom Next.js tidak otomatis menjadi identitas Supabase. Pilih jalur otorisasi yang terbukti; jangan membuka tabel order untuk anon.
3. Route map tunggal. Usulan: / B2B; /order?table=XX masuk pelanggan; /menu, /quiz, /cart; /order/[id]/pay, /track, /receipt; /login, /pos, /kitchen, /admin. Route group tidak membuat URL berbeda.
4. Enum pembayaran dan fulfillment terpisah, transition table, actor, precondition, audit, dan exception handling.
5. Kontrak quote harga, idempotency, token guest, payment attempt, webhook, dan error response.
6. Kontrak rekomendasi tiga dimensi: bobot, jumlah hasil, threshold, tie-break, definisi popularity, dan fallback. Formula flavor×3 + format×2 + mood×1 adalah salah satu usulan dari skils, bukan keputusan yang otomatis menghapus konflik architecture.
7. Auth admin dan staf, wewenang sold-out, masa tunggu tunai, pembatalan/refund, serta harga B2B yang masih OPEN.

Dokumentasikan docs/adr/, docs/api-contracts.md, docs/route-map.md, dan baseline keputusan. Kriteria selesai: keputusan teknis yang diperlukan tahap berikutnya jelas; perubahan biaya atau aturan bisnis yang belum disepakati tetap tercatat sebagai blocker terkait, bukan alasan menghentikan seluruh persiapan.
```

## Prompt 03 — Inisialisasi repository, aplikasi, dan tooling

```text
Scaffold aplikasi berdasarkan ADR. Periksa package.json dan lockfile yang ada terlebih dahulu; repository mungkin sudah berisi generator dokumen. Pertahankan utilitas dan file pengguna. Jangan memaksa create-next-app pada folder berisi file tanpa strategi aman.

Siapkan Next.js App Router, TypeScript strict, Tailwind sesuai versi yang dipilih, alias @/*, ESLint, Prisma, Zod, library auth, dan tooling test. Pin versi langsung yang kritis, package manager, runtime, dan commit lockfile. Jangan menyalin daftar versi lama tanpa verifikasi atau mengunduh seluruh dependency yang belum diperlukan.

Buat layout domain src/app, components, lib atau services, validation, tests, prisma, dan docs. Terapkan batas server-only untuk DB, auth, dan payment. Sediakan .env.example berisi placeholder yang sudah konsisten menggunakan SELA. Environment privat tidak aman hanya karena tidak berprefix NEXT_PUBLIC_; cegah impor modul rahasia ke client secara eksplisit.

Sediakan script dev, lint, typecheck, test, test:integration, test:e2e, build, db:generate, db:migrate:dev, db:migrate:deploy, dan db:seed sesuai tool aktual. Tambahkan CI dasar frozen-lockfile, lint, typecheck, dan build yang tidak membutuhkan secret produksi.

Kriteria selesai: instalasi deterministik dan build minimal berhasil; lint/typecheck lulus; script yang belum punya test tidak dilaporkan sebagai bukti fitur; README menjelaskan setup Windows PowerShell dan environment. Tidak ada koneksi atau migrasi ke database produksi.
```

## Prompt 04 — Database, migration, seed, dan constraint

```text
Implementasikan schema Prisma PostgreSQL dari baseline yang diselaraskan. Gunakan database development/test terpisah.

Cakup meja, kategori, menu, tag, hubungan modifier dengan menu, grup dan opsi modifier, pertanyaan/opsi/pemetaan tag kuis, konfigurasi kafe, staf, sesi/kepemilikan guest, order, item snapshot, modifier snapshot, payment attempt, idempotency record, audit, catatan refund manual, dan pencatatan print request. Tambahkan penyimpanan event atau mekanisme durable setara sesuai ADR jika diperlukan real-time/retry. Jangan membuat tenant_id atau inventori bahan baku.

Simpan harga dan komponen subtotal/pajak/service/total sebagai integer rupiah. Gunakan constraint nilai valid, foreign key, uniqueness nomor order, external order/transaction ID, dan idempotency scope. Tambahkan paidAt, transition timestamps, expiresAt, dan version/conditional update untuk konkurensi. Simpan hash token guest, bukan token mentah yang dapat dibaca melalui query publik.

Soft-delete atau arsipkan menu yang pernah dipesan; perubahan menu tidak boleh merusak struk lama. Terapkan index untuk KDS berdasarkan paidAt/status, antrean kasir, laporan, dan rekonsiliasi pending payment.

Tetapkan satu sumber kebenaran migration: Prisma untuk schema aplikasi; SQL policy/trigger tambahan juga harus versioned dengan mekanisme yang disepakati, tanpa dua migration history yang saling bertabrakan. Jika memakai Supabase, batasi grants dan aktifkan RLS pada schema exposed; buktikan anon tidak dapat membaca transaksi.

Buat seed idempoten 15–20 menu contoh SELA, tiga kategori riil plus tab Semua, kuis tiga langkah, modifier, dan 10 meja contoh. Jangan membuat default credential produksi. Kriteria selesai: migrate dari DB kosong berhasil; seed ulang aman; constraint, snapshot, dan isolasi DB test diverifikasi.
```

## Prompt 05 — Autentikasi staf dan kontrol akses

```text
Implementasikan login/logout dan sesi staf sesuai keputusan auth yang tercatat, menggunakan library teruji. Jika keputusan admin PIN/password masih belum final, selesaikan fondasi auth dan matriks otorisasi tanpa menyatakan pilihan tersebut sudah disepakati.

Gunakan akun/identitas staf yang dapat diaudit, hash PIN/password yang sesuai, cookie HttpOnly, Secure pada HTTPS, SameSite, expiry, dan invalidasi/logout yang berfungsi. Pastikan staf dinonaktifkan tidak tetap berhak memutasi transaksi melalui sesi lama. Jangan menaruh PIN default atau secret di client, seed produksi, README, atau respons API.

Implementasikan RBAC ADMIN/CASHIER/KITCHEN berdasarkan baseline. Lindungi layout, setiap Route Handler/Server Action, data access, upload, dan endpoint real-time. Middleware hanya pemeriksaan awal; mutasi tetap memeriksa otorisasi server. Jangan mempercayai role yang dikirim browser sebagai otoritas.

Terapkan CSRF/origin checks yang sesuai untuk mutasi cookie, pembatasan percobaan login persisten lintas instance, backoff/lockout terukur, validasi input, serta audit login dan aksi sensitif tanpa credential. Webhook gateway memiliki verifikasi sendiri dan tidak boleh terblokir oleh kewajiban cookie staf.

Kriteria selesai: login valid berfungsi; PIN/password salah ditolak; guest tidak mengakses staf; KITCHEN tidak bisa konfirmasi uang atau mengubah harga; session invalid/expired ditolak; direct API request tidak menembus guard; proteksi diuji pada server, bukan hanya tombol yang disembunyikan.
```

## Prompt 06 — Sistem desain dan layout SELA

```text
Bangun fondasi UI reusable dari design.md dan visual-direction.md yang telah diselaraskan. Jika HTML prototipe tersedia, gunakan hanya sebagai referensi visual; jangan mengimpor kode/state simulasi dari design-preview ke aplikasi produksi.

Terapkan token #FBF9F5, #FFFFFF, #924805, #1B1C1A, #241E1B, dan #E7E2DA; Plus Jakarta Sans untuk judul dan Inter untuk isi/angka; tabular numerals, spacing, radius, dan motion SELA. Bundel font dengan jalur yang sesuai build; siapkan fallback jika jaringan build tidak dapat mengambil font.

Buat Button, Input, Badge, Dialog/BottomSheet, Radio/Checkbox, QuantityStepper, Loading/Skeleton, Toast, EmptyState, ErrorState, dan ConnectionBanner. Dialog harus memiliki label, pengelolaan fokus, Escape, scroll lock, dan pemulihan fokus. Uji kontras aktual; jangan menganggap angka tabel warna pasti benar.

Siapkan shell pelanggan dengan header meja, bottom nav Menu/Kurasi/Pesanan/Bantuan, serta ruang floating tray tanpa menutupi safe area. Siapkan shell staf/admin terproteksi. Tombol bantuan menampilkan instruksi atau kontak resmi terkonfigurasi, bukan tautan mati.

Kriteria selesai: layout diperiksa di 360/390/430px, tablet 1024–1280px, dan desktop; touch target mobile ≥44px dan KDS ≥56px; keyboard/focus dan reduced motion berfungsi; tidak ada overflow. Galeri komponen development tidak membuka fitur debug di produksi.
```

## Prompt 07 — Validasi meja dan katalog menu

```text
Implementasikan pintu masuk pelanggan, validasi meja server, katalog dari PostgreSQL, kategori, pencarian, detail menu, dan stok sold-out.

Gunakan route map resmi. Pindai /order?table=07 harus membawa pelanggan ke katalog dengan konteks meja 07. Parameter hilang, tidak terdaftar, atau meja nonaktif menampilkan instruksi scan ulang/hubungi staf dan memblokir checkout. Jangan memilih meja default diam-diam. Jika katalog boleh dibaca tanpa meja, jelaskan bahwa pemesanan tetap memerlukan meja valid.

Tampilkan grid dua kolom, foto, nama, deskripsi, harga Rp28.000, badge Favorit, dan opsi modifier. Category tab Semua merupakan gabungan katalog, bukan keharusan kategori database baru. Sold-out tetap dapat terlihat dengan badge Habis dan tombol tambah terkunci. Sediakan loading, error, retry, empty search, dan offline state yang jujur.

Harga/stok harus diambil dari data nyata. Atur cache dan invalidasi sehingga perubahan admin dapat direfleksikan, serta tetap validasi ulang pada checkout. Tombol stepper untuk item dengan modifier tidak boleh menambahkan varian yang belum dipilih atau menggabungkan dua konfigurasi berbeda.

Kriteria selesai: meja valid/invalid/nonaktif diuji; pencarian dan kategori akurat; menu habis tidak dapat dipesan; nomor meja konsisten saat berpindah halaman. Tidak ada klaim data demo merupakan menu resmi kafe.
```

## Prompt 08 — Kuis tiga langkah dan engine rekomendasi

```text
Implementasikan kuis Suasana → Rasa → Format/Suhu berdasarkan konfigurasi database dan kontrak scoring hasil ADR. Jangan menyalin rumus berbeda dari dokumen yang belum diselaraskan.

Bangun engine murni deterministik, terpisah dari komponen UI. Normalisasi input, baca bobot/pemetaan yang terversi, filter menu aktif tersedia, lalu hitung skor. Terapkan tie-break yang disepakati dan stable final key agar input/data/config identik menghasilkan urutan identik. Popularity, jika digunakan, harus punya definisi data yang jelas; jangan menghitung checkout belum lunas sebagai penjualan.

Tombol Lewati tersedia pada setiap langkah dan langsung membuka katalog lengkap. Hasil kuis menampilkan hero dan alternatif sesuai jumlah hasil yang diputuskan, tag cocok, alasan berdasarkan tag aktual, serta disclaimer konfirmasi alergi kepada staf. Jangan memberi klaim medis. Jika tidak cocok atau kandidat habis, gunakan fallback tersedia; jika seluruh katalog habis, tampilkan empty state tanpa error.

Jangan menggunakan API OpenAI/Gemini/LLM, training model, atau hardcode daftar rekomendasi di komponen. Tulis unit test scoring, tie-break, skip, fallback, perubahan config, input invalid, dan sold-out. Kriteria selesai: hasil konsisten; sumber konfigurasi database terbukti; durasi engine diukur terhadap target <100ms pada dataset uji dan konteks pengukurannya dicatat.
```

## Prompt 09 — Keranjang, modifier, dan quote harga server

```text
Implementasikan modifier bottom sheet dan cart. Gunakan radio untuk grup pilihan tunggal, checkbox untuk add-on, validasi required/min/max, dan nominal tambahan yang transparan. Validasi juga di server; modifier harus milik menu/grup yang benar, tidak boleh diduplikasi atau disisipkan dari menu lain.

Gunakan quantity 1–50 per baris dan catatan maksimal 100 karakter sesuai baseline. Render catatan sebagai teks aman. Dua item dengan modifier/catatan berbeda menjadi baris berbeda. Tambah/kurang/hapus dan edit modifier harus menjaga total estimasi benar. Simpan draft cart lokal bila diperlukan; database tetap sumber kebenaran transaksi.

Buat endpoint quote server yang menerima meja dan pilihan ID/qty, membaca harga/stok resmi, menghitung subtotal serta tax/service 0%, dan mengembalikan quote ID/version dengan masa berlaku. Quote terikat ke sesi, meja, isi keranjang, dan versi harga. Jangan mempercayai total kiriman browser.

Jika harga berubah, quote kedaluwarsa, atau stok habis, minta persetujuan tampilan terbaru sebelum membuat charge. Jangan diam-diam menagih harga baru. Gunakan kode PRICE_CHANGED dan ITEM_STOCK_DEPLETED secara konsisten. Perubahan cart membatalkan quote lama.

Kriteria selesai: perhitungan modifier dan qty tepat; manipulasi payload ditolak; harga berubah terdeteksi melalui quote/version; empty cart tidak checkout; gangguan jaringan mempertahankan draft tanpa membuat order offline.
```

## Prompt 10 — Order service, snapshot, dan idempotensi

```text
Bangun POST /api/orders dan service transaksi dari quote yang telah disetujui. Validasi sesi, meja aktif, item, modifier, stok, dan quote secara server-side. Harga final dikunci dalam snapshot nama/harga/modifier, tax/service, dan total integer IDR.

Buat satu Idempotency-Key acak per niat checkout. Browser harus menggunakan key yang sama saat retry, termasuk setelah timeout atau refresh yang aman. Jangan meregenerasi timestamp/key di setiap request. Key baru hanya untuk niat checkout baru.

Simpan key dalam database dengan scope sesi/operasi, fingerprint payload, state in-progress/completed, dan hasil/referensi yang dapat dipulihkan. Gunakan unique constraint dan transaksi atomik untuk request bersamaan. Key sama + payload berbeda mengembalikan conflict; retry identik mengembalikan order yang sama. Tentukan cara replay respons/token guest tanpa menyimpan token plaintext sembarangan atau membocorkannya ke sesi lain.

Generate orderSecretToken kriptografis atau mekanisme capability setara yang memenuhi DEC-014. Lindungi detail order, pembayaran, receipt, dan tracking. URL ID dan nomor meja bukan otorisasi. Jangan letakkan token pada URL/log bila transport aman lain tersedia.

Pisahkan order creation dari panggilan gateway menggunakan state/payment attempt yang dapat dilanjutkan; jangan menahan transaksi DB selama request eksternal. Order belum lunas tidak masuk KDS.

Kriteria selesai: request paralel/retry menghasilkan satu order; snapshot bertahan setelah edit menu; kepemilikan teruji; order awal punya status jelas; belum ada pembayaran palsu untuk membuat UI terlihat berhasil.
```

## Prompt 11 — Integrasi Midtrans Core API QRIS sandbox

```text
Implementasikan payment adapter Midtrans Core API dalam mode sandbox. Baca dokumentasi resmi charge QRIS untuk acquirer yang digunakan, autentikasi, response actions/qr_string, expiry, Get Status, dan error handling. Gunakan nominal snapshot server, bukan nominal browser.

Charge hanya dapat dimulai oleh pemilik order yang sah dengan metode/state sesuai. Buat merchant order ID unik dan stabil untuk satu payment attempt, lalu persist attempt sebelum request gateway. Simpan transaction ID, amount, status, QR data, dan expiry yang diperoleh/dikonfigurasi sesuai API aktual. Target masa bayar adalah 15 menit.

Jika request timeout setelah gateway mungkin menerima charge, cari status menggunakan ID yang sama sebelum mencoba membuat transaksi lain. Jangan membuat charge ganda, mengganti metode ke tunai ketika QRIS masih aktif/tidak diketahui, atau menganggap timeout sama dengan gagal bayar.

Bangun layar bayar: total resmi, QR gateway, countdown berbasis waktu server/expiresAt, instruksi, simpan QR bila didukung, bantuan, retry terkontrol, dan status menunggu. Pertimbangkan pembayaran dari ponsel yang sama: petunjuk simpan/pindai gambar harus sesuai kemampuan aplikasi pembayaran, tanpa menjanjikan dukungan universal.

MIDTRANS_SERVER_KEY dan pilihan mode server tetap server-only. Jangan menambah Snap/Client Key jika Core API tidak membutuhkannya.

Kriteria selesai: charge nyata sandbox berhasil, amount persis sama, refresh tidak membuat charge kedua, timeout dapat dipulihkan, dan token orang lain tidak dapat dipakai. Tombol pelanggan tidak pernah menetapkan PAID.
```

## Prompt 12 — Webhook, expiry, dan rekonsiliasi pembayaran

```text
Implementasikan webhook Midtrans dan service rekonsiliasi sebagai jalur perubahan status pembayaran yang konsisten. Verifikasi SHA512(order_id + status_code + gross_amount + ServerKey) sesuai representasi string asli provider, gunakan pembandingan aman, validasi schema, dan cocokkan merchant order ID, transaction ID, mata uang, metode, serta nominal snapshot. Parse uang tanpa float/parseInt yang dapat menyembunyikan pecahan tidak sah.

Untuk QRIS, gunakan mapping status sukses QRIS yang didokumentasikan, terutama settlement. Jangan menerima capture generik dari alur kartu sebagai sukses QRIS. Callback palsu/amount mismatch ditolak; payload valid dipersist dan diterapkan atomik sebelum acknowledgment sukses. Jika penyimpanan gagal, kembalikan error retryable sesuai kontrak gateway.

Terapkan dedup, conditional update, paidAt, audit, dan satu event durable untuk order lunas. Duplicate atau out-of-order pending/expire tidak boleh menurunkan PAID, menggandakan omzet, atau memicu event order baru lagi.

Timer client bukan otoritas finansial. Ketika 15 menit habis, UI menutup kesempatan bayar dan meminta status final; server memeriksa Get Status, menggunakan expire/cancel yang didukung bila perlu, serta merekonsiliasi pembayaran pending walau browser tutup atau webhook terlambat. Job terjadwal harus terautentikasi, idempoten, terpantau, dan aman bila berjalan bersamaan.

Bedakan pembayaran tepat waktu dengan webhook terlambat dari dana yang benar-benar masuk setelah pembatalan. Catat semua dana valid; gunakan exception/review dan SOP refund manual sesuai keputusan, tanpa otomatis memasak order batal atau menghilangkan uang dari laporan. Jangan mengklaim waktu expiry provider selalu tepat hingga detik.

Kriteria selesai: settlement sandbox asli terbukti; signature palsu, amount mismatch, duplikat paralel, webhook terlambat, urutan terbalik, job gagal/retry, dan settlement bersamaan dengan expiry diuji. Proses tetap berjalan saat tidak ada browser pelanggan.
```

## Prompt 13 — POS kasir, pembayaran tunai, dan pembatalan

```text
Bangun /pos untuk role kasir/admin yang disepakati. Pisahkan antrean tunai belum lunas dari riwayat lunas. Tampilkan nomor order dan meja, total snapshot, modifier, catatan, metode, status, dan waktu. Jangan memakai nomor meja saja untuk memilih pesanan karena satu meja bisa memiliki lebih dari satu order.

Implementasikan konfirmasi uang masuk dengan dialog jelas dan endpoint server terproteksi. Pastikan order memang CASH, masih menunggu pembayaran, belum dibatalkan/kedaluwarsa menurut kebijakan tunai, dan belum dikonfirmasi. Simpan actor dan paidAt, mutasi atomik, serta event order lunas. Klik ganda atau dua kasir bersamaan tidak boleh menggandakan pembayaran atau tiket dapur.

Pembatalan harus memeriksa state dan role, mewajibkan alasan, serta tercatat pada audit. Untuk order belum lunas, batalkan sesuai kebijakan. Order sudah dibayar tidak boleh ditandai belum pernah dibayar hanya karena fulfillment batal. Refund v1 tetap manual: catat kebutuhan refund dan penyelesaian faktual beserta nominal, metode, actor, timestamp, dan referensi yang aman. Jangan mengubah status menjadi refunded hanya karena tombol batal ditekan; jangan menambah Refund API gateway.

Jika batas tunggu tunai belum disepakati, jangan menerapkan auto-expiry 20 menit sebagai keputusan final. Tampilkan age dan tindakan kasir sesuai baseline.

Kriteria selesai: pembayaran tunai muncul hanya di POS sebelum konfirmasi; setelah PAID muncul tepat sekali di KDS; KITCHEN tidak dapat mengonfirmasi uang; pembatalan, race confirm/cancel, dan refund manual tidak merusak laporan.
```

## Prompt 14 — Kanal real-time dan pemulihan koneksi

```text
Implementasikan mekanisme real-time utama sesuai ADR untuk POS, KDS, tracker, dan invalidasi katalog yang diperlukan. Jangan membangun dua transport lengkap tanpa kebutuhan. Event adalah pemberitahuan; database tetap sumber kebenaran.

Jika memakai SSE, buktikan fan-out bekerja lintas instance/restart dan sesuai batas hosting. Jangan mengandalkan EventEmitter, Map, atau subscriber global dalam satu proses serverless sebagai sistem distribusi. Jika memakai Supabase Realtime, pastikan autentikasi staf/guest benar-benar terhubung ke otorisasi channel. Publishable/anon key tidak memberikan izin membaca semua order. Hindari membuka raw order table ke guest agar stream bekerja.

Batasi kanal staf menurut role dan data yang diperlukan. Kanal pelanggan hanya satu order yang terbukti miliknya. Token tidak boleh bocor ke query log, analytics, payload kanal publik, atau tab pelanggan lain. Bila EventSource tidak mendukung custom header yang dipilih, gunakan cookie order-scoped atau streaming client yang mendukung header sesuai ADR, bukan menurunkan otorisasi.

Gunakan event ID/version, dedup, heartbeat, cleanup koneksi, backoff, dan indikator stale/offline. Saat reconnect/focus kembali, ambil snapshot terbaru melalui API terotorisasi, lalu rekonsiliasi event agar tidak ada celah antara snapshot dan subscribe. Fallback polling hanya saat diperlukan dan diberi status degradasi; interval 15 detik tidak boleh diklaim memenuhi SLA 2 detik.

Kriteria selesai: multi-instance atau pengujian setara membuktikan distribusi; koneksi terputus/restart tidak kehilangan order; akses lintas pesanan ditolak; latensi normal diukur terhadap target ≤2 detik pada beban uji yang dicatat.
```

## Prompt 15 — KDS dapur dan pelacak pelanggan

```text
Bangun /kitchen dan tracker pelanggan dari order service dan real-time aktual. KDS hanya mengambil order PAID dengan fulfillment aktif, urut FIFO berdasarkan paidAt. Enforce filter dan transisi di server; menyembunyikan kartu di UI saja tidak cukup.

KDS menampilkan nomor meja ≥28px, nama item ≥18px, modifier/catatan jelas, usia sejak lunas, dan tombol tinggi ≥56px. Gunakan batas usia konsisten: <10 menit normal, 10–20 perhatian, >20 prioritas. Tetap sediakan teks/ikon, reduced motion, dan penanda visual yang aman.

Transisi fulfillment berjalan maju sesuai baseline: queued/diterima → cooking/dibuat → ready/siap → completed/selesai. Gunakan conditional update/version untuk dua staf yang bertindak bersamaan. Validasi role, status pembayaran, dan current state pada setiap mutasi; simpan audit dan timestamps. Jangan mengubah status finansial untuk menunjukkan progres dapur.

Sediakan Aktifkan Audio Dapur, mute/unmute/volume, chime singkat, serta fallback visual. Dedup berdasarkan event/order sehingga reconnect tidak membunyikan semua order lama; initial snapshot tidak dianggap seluruhnya pesanan baru. Jika tersedia MP3, pastikan lisensi/aksesnya; Web Audio dapat digunakan sesuai ADR tanpa bergantung berkas yang tidak ada.

Tracker menampilkan pembayaran dan fulfillment secara terpisah, bertahan setelah refresh, serta menangani token hilang/invalid, offline, expired, cancelled, dan refund review. Jangan menampilkan riwayat pelanggan lama dari nomor meja.

Kriteria selesai: cash/QRIS belum lunas tidak pernah masuk KDS; alur PAID sampai selesai tersinkronisasi; status konflik aman; chime dan visual diuji; keterbatasan audio perangkat nyata dicatat.
```

## Prompt 16 — Struk digital dan thermal 58/80mm

```text
Implementasikan receipt pelanggan, struk kasir, dan tiket dapur dari snapshot transaksi yang sama. Semua akses harus memverifikasi owner order atau role staf, termasuk HTML print dan endpoint unduhan.

E-receipt memuat SELA, identitas kafe yang sudah dikonfirmasi, nomor pesanan/meja, waktu WIB, item/modifier/qty, subtotal, tax/service, total, metode, dan status finansial aktual. Ringkasan tunai belum dibayar boleh ditampilkan dengan label menunggu pembayaran yang jelas; jangan menyerupai bukti LUNAS.

Buat template CSS @media print 58mm dan 80mm, monokrom, monospace, wrapping nama panjang, dan angka harga yang tidak terpotong. Gunakan ukuran fisik dan lebar cetak driver; jangan menyamakan 384/576 dot printer dengan CSS pixel sebagai jaminan layout. Target sekitar 32/48 karakter hanya acuan yang harus diuji. Tiket dapur menonjolkan meja/modifier/catatan dan tidak membutuhkan nominal keuangan.

Catat permintaan cetak secara atomik per order dan jenis dokumen agar tiket dapur pertama tidak dianggap reprint hanya karena struk kasir sudah dicetak. Permintaan kedua dan seterusnya memiliki label CETAK ULANG/REPRINT. Browser tidak dapat memastikan kertas benar-benar tercetak atau dialog dibatalkan; dokumentasikan sebagai print request/attempt, bukan bukti cetak fisik sukses.

Sediakan simpan/unduh struk sesuai baseline. Kriteria selesai: snapshot cocok dengan charge dan laporan; Print to PDF kedua ukuran diperiksa visual; reprint, nama panjang, banyak item, dan akses ilegal diuji. Uji printer fisik tetap tercatat terpisah; jangan menjanjikan silent print atau kompatibilitas seluruh printer.
```

## Prompt 17 — Admin katalog, foto, modifier, dan stok

```text
Bangun admin menu/kategori yang hanya dapat digunakan role berhak. Cakup tambah/edit/arsip menu, nama, deskripsi, harga integer, foto, kategori, tag, Best Seller, urutan tampilan, modifier group/options, serta toggle tersedia/habis.

Semua validasi dijalankan di server. Foto maksimal 2MB JPG/PNG/WebP; periksa konten sebenarnya, dimensi dan batas pemrosesan, bukan ekstensi/MIME header saja. Gunakan nama objek acak, izin upload terbatas, dan optimasi gambar yang aman. Jangan menyimpan upload di filesystem sementara serverless atau memberikan service role key ke browser. Penggantian foto harus memiliki aturan pembersihan objek lama yang tidak merusak aset masih digunakan.

Perubahan harga/stok/config mencatat actor, timestamp, dan data perubahan yang relevan. Invalidate cache atau publish event sesuai mekanisme real-time sehingga katalog dan rekomendasi membaca kondisi terbaru. UI optimistic update harus rollback jika server menolak.

Mengarsip menu tidak menghapus item historis, payment, audit, atau snapshot struk. Server checkout tetap menolak item/modifier yang sudah tidak aktif walau cart lama masih menyimpannya. Jangan memberi hak toggle stok kepada kasir/dapur jika keputusan hak akses belum menetapkannya.

Kriteria selesai: admin dapat mengelola menu lengkap tanpa edit kode; pengguna lain tidak dapat memanggil mutasi/upload; sold-out langsung tercermin pada katalog dan kurasi; ganti foto dan arsip tidak merusak riwayat; upload berbahaya/terlalu besar ditolak.
```

## Prompt 18 — Kuis dinamis, pengaturan, laporan, dan audit

```text
Lengkapi admin di luar CRUD katalog, termasuk kebutuhan yang tersebar pada PRD, agent, dan design.

1. Kuis: edit label pertanyaan/opsi, aktivasi, urutan, tag mapping, dan bobot jika diizinkan ADR. Baseline awal tiga langkah. Sediakan validasi konfigurasi, versioning, dan penanganan kuis yang sedang dijawab saat config berubah. Jangan menyimpan config yang membuat kuis/rekomendasi crash.
2. Pengaturan: identitas/kontak resmi, jam/zona waktu bila dibutuhkan, dan pajak/service default 0%. Untuk mode inklusif/eksklusif, tetapkan formula serta pembulatan integer server, tampilkan transparan sebelum checkout, dan snapshot hasilnya. Pergantian kebijakan finansial harus mengikuti kewenangan yang disepakati, bukan menyalakan 10%/5% dari contoh dokumen.
3. Laporan: omzet harian, jumlah order lunas, metode bayar, item terjual, dan daftar transaksi dengan filter tanggal/paginasi. Gunakan batas hari Asia/Jakarta secara benar terhadap timestamp UTC. Definisikan gross receipts, refund manual yang telah selesai, dan nilai net; jangan menghitung pending/expired sebagai omzet, atau menghapus pembayaran nyata karena fulfillment cancelled.
4. Ekspor CSV sesuai baseline, dengan proteksi formula injection untuk teks yang dapat dimasukkan pengguna. Audit log harga, stok, konfirmasi tunai, pembatalan, refund, status, dan permintaan cetak bersifat append-only melalui aplikasi; jangan menampilkan token/credential/payload sensitif.

Kriteria selesai: perubahan config langsung bekerja tanpa code edit; perhitungan inklusif/eksklusif dan pembulatan diuji; laporan cocok dengan dataset transaksi/refund yang diketahui termasuk batas pergantian tanggal; role tanpa izin ditolak; semua kebutuhan tambahan mendapat ID kanonis.
```

## Prompt 19 — Pengelolaan meja dan generator master QR

```text
Implementasikan admin meja: nomor/label unik, status aktif, dan generator QR dengan route pelanggan resmi. QR meja hanya berisi URL publik meja; jangan memasukkan orderSecretToken, cookie, PIN, atau secret yang memberikan akses pesanan.

Sediakan unduhan satuan PNG minimal 600×600px dan SVG, serta unduhan massal ZIP atau sheet PDF siap cetak sesuai acceptance criteria. Sertakan label meja yang terbaca, quiet zone, kontras, dan ukuran fisik yang layak dipindai. Jika menghasilkan PDF, render dan periksa layout sebelum menyatakan selesai.

Base URL berasal dari konfigurasi deployment yang tervalidasi. Bedakan QR staging dengan master produksi secara jelas. Jika domain final belum tersedia, selesaikan fitur menggunakan domain staging dan tandai master live BLOCKED; jangan mencetak massal URL sementara seolah-olah permanen.

Pastikan deaktivasi meja memblokir checkout baru tanpa menghilangkan akses sah ke order historis pelanggan/staf. Jangan menghapus transaksi saat meja diarsipkan atau digunakan pelanggan berikutnya.

Kriteria selesai: scan beberapa QR hasil unduhan benar-benar membuka meja sesuai label; hasil satuan/massal lengkap dan konsisten; SVG/PDF/PNG tidak terpotong; QR meja yang sama tidak membuka riwayat pelanggan sebelumnya. Uji scan fisik saat hasil cetak tersedia dan catat perangkatnya.
```

## Prompt 20 — Landing B2B, demo kuis, dan CTA

```text
Bangun landing B2B pada route publik yang sudah ditentukan. Gunakan identitas visual SELA dan kebutuhan pemasaran sumber: hero, nilai produk, fitur pelanggan/QRIS/KDS/admin, penjelasan alur, demo kuis, rincian paket, FAQ, dan CTA WhatsApp.

Demo memakai dataset contoh terisolasi yang disimpan sebagai aset demo tersendiri. Boleh berbagi engine rekomendasi murni, tetapi jangan mengimpor folder design-preview atau menghubungkan demo ke order/payment operasional. Labeli Simulasi/Interactive Preview. Buktikan pengunjung demo tidak dapat membuat order atau membaca transaksi kafe.

Rp750.000 dalam PRD dan Rp2.500.000 di dokumen desain harus direkonsiliasi sebagai konteks komersial berbeda atau keputusan terbuka. Hanya publikasikan harga yang dikonfirmasi. Jangan menjanjikan hosting gratis, MDR universal 0,7%, hardware termasuk, hasil bisnis pasti, garansi bebas bug mutlak, atau live dalam tujuh hari tanpa syarat. Jelaskan tanggung jawab domain/hosting tahun pertama sesuai kontrak dan ketergantungan KYC/perangkat.

Gunakan nomor WA bisnis resmi dari konfigurasi dengan pesan URL-encoded. Jika nomor atau harga belum tersedia, siapkan konfigurasi dan nyatakan blocker publikasi konten; jangan membuat nomor kontak atau testimonial fiktif. Tautan CTA membuka percakapan; tidak mengirim pesan otomatis.

Kriteria selesai: demo dan CTA berfungsi pada mobile/desktop; metadata/OG memakai konten benar; konten rahasia tidak terpapar; harga dan klaim tervalidasi; tidak ada route root ganda atau link mati.
```

## Prompt 21 — Audit keamanan, performa, dan aksesibilitas

```text
Audit implementasi seluruh modul, lalu perbaiki temuan dalam scope sebelum UAT akhir. Gunakan matriks kebutuhan dan batas kepercayaan, bukan sekadar linter.

Prioritaskan: akses langsung API tanpa role; IDOR/BOLA pada detail order/payment/receipt/download/stream; manipulasi meja/harga/modifier/qty; brute force login dan abuse checkout; CSRF/origin; XSS catatan/menu; upload; kebocoran token/secret di client, log, cache, export, atau analytics; RLS/grants/storage/realtime; endpoint job/health/debug; dependency advisory dan runtime support. Rate limit harus efektif lintas instance; hindari pemblokiran seluruh pengunjung kafe hanya karena satu IP bersama.

Uji race condition order/payment/cash confirmation, replay idempotency lintas sesi, duplikat webhook, status mundur, expiry, dan pergantian metode bayar. Pastikan seluruh proteksi bekerja pada server dan database. Jangan hanya mengandalkan scanner otomatis.

Ukur LCP terhadap target ≤2,5 detik pada profil jaringan/perangkat yang dicatat; optimalkan gambar/font/bundle, query/index, pooling, dan cache publik vs privat. Ukur latensi KDS ≤2 detik pada 10 order bersamaan dalam kondisi normal. Hindari caching data order antar pengguna.

Periksa keyboard, fokus/dialog, label, screen-reader status, kontras aktual, ukuran target, safe area, reduced motion, dan layout 360–1920px. Header keamanan harus kompatibel dengan payment, storage, font, dan real-time yang digunakan.

Kriteria selesai: temuan critical/high dan defect finansial/operasional utama diselesaikan serta diuji ulang; sisanya tercatat dengan dampak dan owner; tidak ada hasil audit yang diklaim lebih luas dari pengujian aktual.
```

## Prompt 22 — Pengujian integrasi, E2E, dan UAT penuh

```text
Jalankan verification menyeluruh pada candidate build dan database test/staging terpisah. Update traceability matrix dengan tautan test/bukti aktual. Jangan mengganti integrasi asli dengan fixture lalu mengklaim payment sandbox sudah teruji.

Jalankan unit/integration/E2E yang relevan, lint, typecheck, dan production build. Lakukan minimal satu alur sandbox asli: scan meja → kuis/skip → modifier/cart → quote → checkout QRIS → bayar via simulator resmi → webhook → PAID → KDS → cooking/ready/completed → tracker/receipt. Jalankan pula alur tunai penuh dengan kasir menerima konfirmasi sebelum KDS.

Eksekusi seluruh UAT-01 sampai UAT-17 dari PRD yang telah diselaraskan. Tambahkan coverage untuk kuis dinamis, setting pajak, laporan/refund, audit, upload, privasi pelanggan berbeda pada meja yang sama, token salah, login/role, quote berubah, idempotency paralel, charge timeout, late webhook, expiry race, print/reprint, dan demo B2B terisolasi.

Uji 50 transaksi sandbox berurutan dan 10 order bersamaan sesuai target sumber; verifikasi jumlah order, payment, omzet, dan event konsisten. Gunakan replay terkontrol untuk edge case, tetapi bedakan pengujian mock dari sandbox asli. Uji Chromium/WebKit sesuai target dan perangkat Android/iPhone/staf nyata bila tersedia.

Simpan docs/uat-report.md dan bukti yang disanitasi. Printer, audio, scan fisik, atau live payment yang belum dicoba tetap NOT RUN/BLOCKED. Jangan mengubahnya menjadi PASS dari emulator.

Kriteria selesai: nol critical/major defect; maksimal dua minor hanya jika diterima pemilik sesuai PRD; semua kebutuhan punya bukti atau blocker eksplisit. Build berhasil saja tidak cukup untuk menyatakan siap produksi.
```

## Prompt 23 — Operasional, backup/restore, CI/CD, dan staging

```text
Siapkan kemampuan operasional dan release candidate di staging yang terpisah dari live. Gunakan provider/paket yang sudah ditetapkan; jangan membeli paket atau mengubah tagihan sebagai efek samping.

Pisahkan DB, gateway mode, credential, storage, domain, dan job untuk development/test/staging/production. Staging memakai sandbox dan akses yang dibatasi bila diperlukan; webhook simulator harus dapat mencapai endpoint staging tanpa mematikan proteksi staf. Preview tidak boleh mengakses database atau key live.

Lengkapi CI/CD: frozen lockfile, lint/typecheck, unit/integration, build, smoke/E2E penting, artifact/commit yang dapat ditelusuri, validasi environment, dan migration deploy yang dijalankan terkendali sekali per rilis. Gunakan perubahan schema backward-compatible; jangan memakai migrate dev/reset pada produksi. Pisahkan proses seed demo dari deploy live.

Tambahkan log JSON terstruktur dan correlation ID tanpa secret/token; monitoring uptime, error rate, webhook failure, umur payment pending, mismatch settlement, koneksi/staleness KDS, job reconciliation, DB capacity, dan biaya/kuota. Health endpoint publik cukup minimum; rincian internal harus terproteksi. Lakukan simulasi alert dan tetapkan PIC.

Tetapkan RPO <24 jam sesuai kebutuhan dan RTO yang disepakati. Jadwalkan backup dengan interval yang memadai beserta margin kegagalan, retensi, enkripsi, penyimpanan off-site, dan alert bila terlambat. Jangan bergantung backup free yang tidak dapat diakses. Cadangkan object storage foto secara terpisah bila tidak tercakup backup DB.

Lakukan restore drill ke lingkungan terisolasi; periksa order, payment, audit, config, dan foto. Ukur waktu pulih, jangan menimpa live. Tulis runbook insiden, rekonsiliasi, rollback aplikasi, kompatibilitas schema, serta strategi forward-fix; rollback aplikasi tidak berarti membalik migrasi destruktif.

Kriteria selesai: staging terdeploy dari commit teridentifikasi; smoke test dan alert berhasil; backup nyata dan restore berhasil dengan bukti tersanitasi; candidate rilis dan runbook siap dinilai.
```

## Prompt 24 — Pemeriksaan akhir dan rilis produksi

Prompt ini dipakai ketika pengguna memang hendak merilis. Mengirimkannya merupakan instruksi tertulis untuk rilis pada lingkungan yang sudah diidentifikasi; batas lingkungan dan tindakan harus jelas. Jika prasyarat belum lengkap, agent menyiapkan rilis dan melaporkan blocker, tanpa menyebut situs sudah live.

```text
Rilis candidate yang sudah lulus UAT ke environment produksi SELA yang sudah tercatat pada release configuration. Instruksi ini mencakup deployment aplikasi dan migration deploy non-destruktif yang telah ditinjau untuk rilis tersebut. Jangan mengubah audience, provider/tagihan, kebijakan bisnis, atau menjalankan tindakan destruktif di luar cakupan ini.

Sebelum melakukan perubahan live, periksa bukti konkret:
- Harga/menu/modifier, meja, identitas/kontak, dan konten pemasaran sudah disahkan; data contoh sudah diganti/ditandai secara benar.
- Domain/DNS/HTTPS, hosting komersial, DB/storage, runtime dan dependency aman, serta kapasitas tersedia.
- Merchant Midtrans live dan QRIS acquirer aktif; key dimasukkan melalui secret manager, mode server benar, webhook URL produksi benar, serta fitur sandbox/debug tidak tersedia di live.
- Auth/RBAC, token order, job reconciliation/expiry, backup/restore, monitoring, dan rollback telah lolos pemeriksaan.
- UAT, audio tablet, printer fisik 58/80mm sesuai perangkat yang dijanjikan, dan scan QR telah diuji; tidak ada critical/major terbuka.
- Commit/artifact dan migration yang akan dirilis sama dengan candidate yang diuji. Ada backup pra-migrasi dan catatan dampak schema.

Jika ada blocker, selesaikan bagian aman yang independen dan tulis keputusan NO-GO beserta syarat yang belum terpenuhi. Jangan mengakali blocker dengan mengendurkan kitchen gate, membuka akses publik order, menandai pembayaran sukses manual, atau mengaku sandbox merupakan live.

Jika semua gate terpenuhi, jalankan urutan migrasi/deployment yang telah ditetapkan, aktifkan konfigurasi produksi, dan lakukan smoke test publik/protected route serta job tanpa transaksi uang nyata. Periksa status deployment sampai terminal; verifikasi URL yang benar-benar berjalan dan commit/revision-nya.

Transaksi uang nyata hanya dijalankan bila nominal maksimum dan instruksi uji live telah dinyatakan terpisah secara eksplisit. Jika belum, tandai LIVE PAYMENT VALIDATION PENDING; jangan menyatakan pembayaran live telah lolos. Jika sudah diizinkan, buktikan charge → bayar → webhook → PAID → KDS → receipt dan pencatatan merchant sesuai batas uji.

Laporkan URL, commit/release ID, waktu WIB, hasil smoke test, validasi pembayaran live, status rollback/alert, dan blocker tersisa. Kriteria selesai: deployment sehat terverifikasi; status teknis dan kesiapan menerima pelanggan dilaporkan terpisah bila live validation belum selesai.
```

## Prompt 25 — Serah terima, SOP, dan pemantauan awal

```text
Siapkan serah terima SELA berdasarkan sistem yang benar-benar sudah dirilis dan diuji. Jangan menyatakan pelatihan atau uji fisik telah dilakukan jika baru menulis panduannya.

Buat panduan operasional kasir/barista/admin dalam Bahasa Indonesia, termasuk PDF siap cetak. Ikuti workflow render dan periksa hasil visual jika membuat PDF/DOCX. Cakup login/shift, audio unlock, kasir cash-confirm, KDS, menu sold-out, cetak/reprint, order tertahan, gangguan koneksi, QRIS pending/expired/late settlement, pembatalan, refund manual, dan kontak eskalasi. Jangan mengajarkan staf menetapkan PAID dari screenshot pelanggan.

Siapkan master QR produksi berlabel meja, README setup/maintenance, environment key inventory tanpa nilai rahasia, daftar layanan dan pemilik akun, backup/restore/runbook, biaya dan jadwal pembaruan domain/hosting, serta release/known-issues log. Penyerahan credential menggunakan mekanisme aman; jangan memasukkan password/PIN/server key dalam PDF atau repo.

Susun dan lakukan simulasi bersama staf jika sesi/perangkat tersedia. Catat peserta, skenario, hasil dan tanggal aktual. Pindai QR yang sudah terpasang dan lakukan uji cetak/audio di perangkat kasir/dapur yang dipakai operasional. Jika belum tersedia, buat checklist handover berstatus belum selesai.

Tetapkan pemantauan awal 24–72 jam sebagai rencana operasional: error/webhook, pending payments, KDS lag, backup, laporan pendapatan vs merchant, biaya/kuota, serta siapa yang menanggapi alert. Jangan mengklaim telah memantau di masa depan; bila otomatisasi diperlukan, buat hanya sesuai instruksi jadwal yang benar-benar diberikan pengguna.

Kriteria selesai: pemilik memiliki akses admin dan layanan yang disepakati; master QR dan SOP final tersedia; staf lulus simulasi aktual; laporan handover membedakan selesai/tertunda; ownership maintenance serta daftar risiko tersisa jelas.
```

---

## Prompt pemulihan konteks — Jika pindah chat atau melanjutkan pekerjaan

```text
Lanjutkan proyek SELA tanpa mengulang scaffold atau menimpa perubahan pengguna. Baca instruksi induk, lokasi dokumen kanonis, docs/project-context.md, docs/implementation-progress.md, requirements traceability, ADR, dan laporan pengujian terakhir.

Periksa git status, branch/commit, diff pengguna, package scripts, migration state, serta environment yang sedang aktif tanpa mencetak secret. Tentukan tahap terakhir yang benar-benar selesai dari bukti, bukan label status di dokumen lama.

Laporkan singkat: kondisi repository; tahap lulus; pekerjaan setengah selesai; blocker; dan tahap berikutnya. Jika tahap yang saya minta memiliki prasyarat gagal, perbaiki prasyarat relevan terlebih dahulu. Jangan mengulang implementasi yang sudah valid, menulis ulang arsitektur, atau memindahkan data produksi untuk memulihkan konteks.
```

## Prompt perbaikan — Jika quality gate gagal

```text
Quality gate tahap ini belum lulus. Temukan akar masalah dari log dan kode aktual, lalu perbaiki dalam scope tahap yang sama. Jangan menghapus test, melemahkan assertion, mengganti integrasi dengan mock tanpa label, atau menonaktifkan auth/invarian agar build hijau.

Tulis test regresi yang bermakna untuk bug finansial, akses data, konkurensi, atau state transition. Jalankan ulang pemeriksaan relevan. Jika masalah berasal dari dependency/environment yang belum tersedia, laporkan BLOCKED dengan bukti dan lanjutkan hanya bagian yang independen.

Perbarui progress log, root cause, perubahan, pemeriksaan aktual, dan hasil gate. Jangan melanjutkan ke tahap yang bergantung pada gate ini sebelum syaratnya terpenuhi.
```

## Checklist akhir yang harus terbukti

| Area | Bukti minimum sebelum dinyatakan siap operasional |
|---|---|
| Cakupan | Seluruh kebutuhan kanonis dan alias sumber punya status serta bukti; semua lima modul selesai. |
| Integritas order | Harga integer server, quote, snapshot, dan retry paralel menghasilkan data yang konsisten. |
| Pembayaran | QRIS dan tunai benar; webhook/rekonsiliasi/expiry/retry aman; uang valid tidak hilang dari pencatatan. |
| Operasional | KDS PAID-only, transisi benar, FIFO paidAt, reconnect, audio/visual, dan cetak fisik berhasil. |
| Privasi | QR meja tidak membuka pesanan lain; API/receipt/download/stream mempunyai pemeriksaan kepemilikan/role. |
| Admin | Menu/foto/modifier/stok/tag/kuis/meja/pajak/laporan/audit dapat dikelola sesuai hak akses. |
| B2B | Demo terisolasi, harga resmi, CTA benar, dan klaim dapat dipertanggungjawabkan. |
| Kualitas | Lint/typecheck/test/build, UAT-01–17 dan tambahan, audit keamanan/performa/aksesibilitas lulus sesuai konteks uji. |
| Infrastruktur | Hosting komersial, runtime didukung, environment terpisah, DNS/HTTPS, scheduler, pooling, kuota, dan biaya jelas. |
| Pemulihan | Backup aktual dapat diakses, restore drill berhasil, RPO/RTO tercatat, alert dan runbook diuji. |
| Rilis | Commit/artifact teridentifikasi, migration aman, smoke test sehat, validasi live payment tercatat sesuai izin. |
| Handover | SOP PDF/master QR/akses pemilik/pelatihan staf dan tanggung jawab maintenance terverifikasi. |

Jika masih ada blocker pembayaran live, printer wajib, keamanan, backup, atau otorisasi, laporkan status kesiapan secara spesifik. Istilah “production ready” tidak menggantikan bukti di atas.

## Referensi eksternal untuk pemeriksaan ulang

Referensi ini melengkapi sembilan dokumen proyek; tidak mengubah keputusan bisnis tanpa pencatatan.

- [Vercel Hobby dan pembatasan penggunaan](https://vercel.com/docs/plans/hobby)
- [Node.js EOL](https://nodejs.org/en/about/eol)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Midtrans QRIS Core API](https://docs.midtrans.com/reference/qris)
- [Midtrans GoPay/QRIS POS integration dan expiry](https://docs.midtrans.com/docs/gopay-qris-pos-integration)
- [Midtrans technical FAQ](https://docs.midtrans.com/docs/technical-faq)

Periksa sumber resmi lagi pada saat implementasi untuk security patch, dukungan runtime, kemampuan layanan, batas paket, serta parameter API yang dipilih.
