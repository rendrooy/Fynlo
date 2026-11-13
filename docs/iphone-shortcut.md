# Shortcut iPhone ke Fynlo

Setiap kali notifikasi transaksi dari Jago atau wondr by BNI masuk, iPhone mengirim teksnya ke Fynlo. Fynlo mencatatnya sebagai transaksi yang menunggu di Review. Saat statement bulanan diimport, transaksi itu dikonfirmasi. Detail cara kerjanya ada di `docs/notification-ingest.md`.

API harus bisa diakses dari internet, jadi `localhost` tidak bisa dipakai. Di VPS, alamatnya `https://IP_VPS.sslip.io/v1` (lihat `docs/deploy.md`).

## Sebelum mulai

1. Pastikan akun di Fynlo sudah punya 4 digit terakhir (`mask`):
   - Jago Utama: `2734`
   - BNI: `7295`
2. Opsional: buat akun bernama **GoPay Tabungan**. Pembayaran "dengan Transaksi GoPay Tabungan" akan masuk ke akun itu. Kalau akunnya tidak ada, transaksinya masuk ke Jago Utama.
3. Pastikan nama di profil Fynlo sama dengan nama di rekening bank. Nama ini dipakai untuk mengenali transfer antar rekening sendiri.
4. Buka **Settings → Automation → New Token**, beri nama (misalnya `iPhone`), lalu salin tokennya. Token hanya ditampilkan sekali. Satu token bisa dipakai untuk kedua Shortcut.

## Membuat automation

Buat dua automation dengan isi yang sama. Yang berbeda hanya aplikasi pemicu, `source`, dan `account`.

| Bagian    | Jago     | BNI            |
| --------- | -------- | -------------- |
| Aplikasi  | Jago     | wondr by BNI   |
| `source`  | `jago`   | `bni`          |
| `account` | `2734`   | `7295`         |

### Langkah

1. Buka aplikasi **Shortcuts → Automation → + (New Automation)**.
2. Pilih **App Notification** (When I receive a notification from…), lalu pilih aplikasinya: **Jago** atau **wondr by BNI**.
3. Pilih **Run Immediately**, dan matikan **Notify When Run**. Tanpa ini, iPhone meminta konfirmasi setiap kali ada notifikasi.
4. Tambah aksi **Get Contents of URL**, lalu isi:
   - **URL:** `https://IP_VPS.sslip.io/v1/ingest/notification`
   - **Method:** `POST`
   - **Headers:** satu header saja.

     | Key             | Value                                      |
     | --------------- | ------------------------------------------ |
     | `Authorization` | `Bearer fyn_...` (ada spasi setelah `Bearer`) |

   - **Request Body:** `JSON`, dengan tiga field bertipe **Text**:

     | Key       | Value                                         |
     | --------- | --------------------------------------------- |
     | `msg`     | variabel **Notification** (pilih dari daftar variabel) |
     | `source`  | `jago` atau `bni`                             |
     | `account` | `2734` atau `7295`                            |

5. Simpan, lalu ulangi untuk aplikasi kedua.

Kalau mengikuti draf Shortcut yang lama:

- Ganti header `fynlo-token` menjadi `Authorization`, dengan nilai `Bearer ` diikuti token.
- Hapus header `source`, lalu pindahkan `source` ke Request Body.
- Tambah field `account` di Request Body.

## Mengecek hasilnya

Lakukan transaksi kecil, lalu buka **Settings → Automation → Recent messages**. Pesan dari Shortcut ditampilkan dengan teks notifikasinya.

| Status          | Artinya                                                      | Yang perlu dilakukan                                       |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Recorded        | Transaksi baru dibuat dan menunggu di Review                 | Pilih kategorinya di Review, atau tunggu import statement  |
| Matched         | Digabung dengan transaksi yang sudah ada, misalnya sisi kedua transfer | Tidak ada                                            |
| Check duplicate | Ada transaksi lain yang mirip                                | Cek di Review                                              |
| No account      | Tidak ada akun dengan 4 digit `account`                      | Isi 4 digit akun di Fynlo, lalu tekan Retry                |
| Couldn't read   | Format notifikasi belum dikenal                              | Kirim contohnya supaya parser ditambah, lalu tekan Retry   |
| Ignored         | Bukan transaksi: promo, kartu kredit, pindah kantong, QR gagal | Tidak ada                                                |

Kalau tidak ada pesan sama sekali di Recent messages, request-nya tidak sampai ke Fynlo. Penyebabnya bisa:

| Gejala                                  | Penyebab yang mungkin                                         |
| --------------------------------------- | ------------------------------------------------------------- |
| Automation tidak jalan                  | **Run Immediately** belum dipilih, atau automation-nya nonaktif |
| Error 401 saat Shortcut dijalankan      | Token salah atau sudah dicabut, atau `Bearer ` tidak ada       |
| Error 400 "Source must be jago or bni"  | `source` belum dipindah ke Request Body, atau isinya salah ketik |
| Error 400 "Account must be…"            | Field `account` belum ada                                      |
| Error 429                               | Lebih dari 300 request dalam 15 menit                          |

Untuk melihat pesan error, jalankan Shortcut-nya sekali secara manual dari aplikasi Shortcuts. Hasil **Get Contents of URL** akan menampilkan respons dari Fynlo.

## Yang perlu diketahui

- **Waktu transaksi** adalah waktu notifikasi diterima Fynlo. Jam yang tepat diambil dari statement saat import.
- **Transfer antar rekening sendiri** dicatat sebagai satu transfer kalau kedua notifikasinya masuk dalam 10 menit dengan nominal yang sama.
- **Notifikasi yang dikirim dua kali dalam menit yang sama** hanya dicatat sekali.

## Kalau token bocor

Cabut token di **Settings → Automation**, buat yang baru, lalu ganti di kedua Shortcut. Token ini hanya bisa mengirim pesan, tidak bisa membaca data keuangan.
