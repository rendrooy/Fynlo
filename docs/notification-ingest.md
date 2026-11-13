# Notifikasi iPhone ke Fynlo

Status: **API sudah dibangun** (`POST /v1/ingest/notification`). Konfirmasi lewat import statement belum.

Shortcut di iPhone mengirim teks notifikasi bank ke Fynlo. Fynlo mengubahnya menjadi transaksi yang menunggu di Review. Fitur ini berdampingan dengan ingest Gmail (`docs/gmail-ingest.md`) dan memakai ulang token, log pesan, serta aturan pencocokannya. Bagian yang baru hanyalah cara membaca teks notifikasinya.

## Keputusan

Diambil dari jawaban pertanyaan terbuka di akhir dokumen.

| #   | Keputusan                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ada dua automation Shortcut, "When I receive a notification from Jago" dan "… from wondr by BNI". Masing-masing mengirim `source` yang tetap: `jago` atau `bni`.            |
| 2   | Notifikasi kantong Jago (`menarik … dari Kantong`, `dipindahkan dari Kantong … ke Kantong`) **diabaikan**. Pindahan kantong dicatat saat import statement.                   |
| 3   | Notifikasi singkat tanpa nama bank (`Transaksi Berhasil!`, `Transaksi diterima!`, `Pembayaran … pakai QRIS`) berasal dari BNI Wondr.                                         |
| 4   | Notifikasi kartu kredit AMEX **diabaikan**, termasuk pembayaran tagihannya.                                                                                                |
| 5   | Transaksi dari notifikasi selalu masuk Review. Transaksi itu **terkonfirmasi lewat import statement**: baris statement yang cocok mengonfirmasi transaksinya, bukan membuat transaksi baru. |
| 6   | Nama `GoPay` dan `Kartu debit Jago` untuk pembayaran tanpa merchant sudah cukup.                                                                                           |
| 7   | Waktu transaksi = waktu server saat notifikasi diterima (`now()`). Shortcut tidak perlu mengirim waktu.                                                                     |
| 8   | Transfer ke nama orang lain selalu expense. Hanya transfer ke/dari nama sendiri yang dicatat sebagai transfer.                                                            |
| 9   | Akun tujuan: Shortcut Jago → akun berakhiran **2734**, Shortcut BNI → akun berakhiran **7295**. Shortcut mengirim 4 digit ini di field `account`.                          |
| 10  | Token dikirim lewat header `Authorization: Bearer …` seperti ingest Gmail, bukan header `fynlo-token`, supaya pengecekan tokennya sama untuk semua ingest.                   |

## Shortcut di iPhone

Ada dua automation, satu per aplikasi. Isinya sama, kecuali aplikasi pemicu, `source`, dan `account`.

| Bagian                         | Jago                                       | BNI                                          |
| ------------------------------ | ------------------------------------------ | -------------------------------------------- |
| Trigger                        | When I receive a notification from **Jago** | When I receive a notification from **wondr by BNI** |
| Aksi                           | Get contents of URL                        | Get contents of URL                          |
| URL                            | `https://<api>/v1/ingest/notification`     | sama                                         |
| Method                         | POST                                       | POST                                         |
| Header `Authorization`         | `Bearer fyn_...`                           | sama                                         |
| Request Body                   | JSON                                       | JSON                                         |
| Field `msg`                    | variabel **Notification**                  | variabel **Notification**                    |
| Field `source`                 | `jago`                                     | `bni`                                        |
| Field `account`                | `2734`                                     | `7295`                                       |

Di pengaturan automation, pilih **Run Immediately** dan matikan **Notify When Run**. Tanpa itu, iPhone meminta konfirmasi setiap kali ada notifikasi.

Perbedaan dengan draf Shortcut yang sekarang:

- Header `fynlo-token` diganti `Authorization`, dengan nilai `Bearer ` diikuti token (ada spasi setelah `Bearer`).
- Header `source` dipindah ke Request Body, lalu ditambah field `account`.
- Di Shortcut BNI, header token dan `source` masih kosong.
- URL masih kosong di kedua Shortcut.

## Endpoint

```
POST /v1/ingest/notification
Authorization: Bearer fyn_...        (token dari Settings → Automation)
Content-Type: application/json

{ "msg": "<Notification>", "source": "jago", "account": "2734" }
```

| Field     | Wajib | Contoh                               | Keterangan                                                                                         |
| --------- | ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `msg`     | ya    | variabel **Notification** dari trigger | Teks notifikasi. Biasanya baris pertama judul (`Jago`, `Transaksi Berhasil!`), sisanya isi. Maksimal 2.000 karakter. |
| `source`  | ya    | `"jago"` atau `"bni"`                | Diisi tetap di masing-masing Shortcut. Menentukan parser. Huruf besar/kecil diabaikan.             |
| `account` | ya    | `"2734"` atau `"7295"`               | 4 digit terakhir akun, diisi tetap di masing-masing Shortcut. Dicocokkan dengan `mask`.            |

Token dikirim di header `Authorization` dengan awalan `Bearer `, sama seperti ingest Gmail. `source` dan `account` dikirim di body, bukan di header.

Responsnya sama dengan ingest email: `{ "data": { "status": "created" } }`. Status yang mungkin: `created`, `merged`, `ambiguous`, `unmatched`, `ignored`, `failed`, atau `duplicate`.

`POST /v1/ingest` dengan `source: "email"` yang sudah ada tetap dipakai untuk Gmail.

### Waktu transaksi

Notifikasi tidak menyebut tanggal maupun jam, jadi waktu transaksi diambil dari waktu server saat request diterima. Kalau Shortcut terlambat mengirim, jamnya ikut bergeser. Ini tidak masalah, karena import statement nanti mengonfirmasi transaksinya berdasarkan tanggal (lihat "Konfirmasi lewat import statement").

### Kiriman ganda

Teks yang sama memang bisa muncul berkali-kali, misalnya "Rp 6.000 ke warkop rudi" setiap pagi. Fynlo memakai hash dari `source + msg + waktu server` (dibulatkan ke menit) sebagai ID pesan. Dengan begitu, Shortcut yang tidak sengaja mengirim dua kali dalam menit yang sama dicatat sebagai `duplicate`, sedangkan kopi yang sama besok tetap tercatat sebagai pesan baru.

Akibatnya, dua pembelian dengan nominal dan merchant yang sama dalam satu menit dihitung satu. Kasus ini jarang terjadi, dan import statement nanti akan menambahkan yang kurang.

## Format pesan

Format di bawah diambil dari 117 contoh notifikasi. Nama dan nomor kartu sudah diganti dengan placeholder.

### Jago (`source: "jago"`)

| Format                                                                           | Menjadi                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Kamu telah membayar Rp 39.000 ke {merchant}.`                                   | Expense, nama = merchant                                   |
| `Kamu telah melakukan transaksi sebesar Rp16.500 melalui GoPay.`                 | Expense, nama =`GoPay`                                     |
| `Kamu telah melakukan pembayaran sebesar Rp43.500 menggunakan kartu debit Jago.` | Expense, nama =`Kartu debit Jago`                          |
| `Kamu telah membayar Rp14.000 dengan Transaksi GoPay Tabungan.`                  | Expense dari kantong GoPay Tabungan                        |
| `Kamu telah melakukan transfer Rp70.000 ke {nama}.`                              | Expense ke {nama}, atau transfer kalau {nama} adalah kamu  |
| `{nama} telah mengirim Rp800.000 ke kamu.`                                       | Income dari {nama}, atau transfer kalau {nama} adalah kamu |
| `Rp50.000 telah dipindahkan dari Kantong {A} ke Kantong {B}.`                    | Diabaikan (keputusan 2)                                    |
| `Kamu menarik Rp50 dari Kantong {A}.`                                            | Diabaikan (keputusan 2)                                    |
| `Pembayaran QR ke {merchant} gagal.`                                             | Diabaikan                                                  |
| `{nama} telah ditambah ke daftar kontak kamu.`                                   | Diabaikan                                                  |

Semua teks Jago diakhiri `Butuh bantuan? Silakan Tanya Jago di 1500 746.`. Kalimat ini dibuang sebelum teks dibaca.

### BNI Wondr (`source: "bni"`)

| Judul                 | Teks                                                        | Menjadi                     |
| --------------------- | ----------------------------------------------------------- | --------------------------- |
| `Transaksi Berhasil!` | `Kamu baru aja transaksi sebesar Rp800.000. Klik untuk ...` | Expense, nama = `BNI`       |
| `Transaksi diterima!` | `Kamu baru aja terima Rp1.068.750. Klik untuk ...`          | Income, nama = `BNI`        |
| `Transaksi berhasil`  | `Pembayaran Rp.8.000 pakai QRIS udah diterima {merchant}.`  | Expense, nama = merchant    |

Dua notifikasi pertama tidak menyebut tujuan, jadi namanya hanya `BNI`. Nama yang benar akan terisi saat statement diimport (keputusan 5).

### Kartu kredit (diabaikan)

Notifikasi dengan `AMEX 0370 13** ****`, baik transaksi QRIS maupun pembayaran tagihan, langsung `ignored` (keputusan 4). Notifikasi ini bisa muncul lewat Shortcut BNI, jadi parser BNI harus mengenalinya sebelum mencoba format lain.

### Promosi

Pesan yang tidak cocok dengan format mana pun di atas akan `ignored`. Contohnya penawaran deposito, cashback kartu, promo 11.11, dan Jago Amal.

## Memilih akun

Notifikasi tidak menyebut nomor rekening, jadi akunnya dikirim oleh Shortcut lewat field `account` (keputusan 9):

| Shortcut | `source` | `account` |
| -------- | ------ | --------- |
| Jago     | `jago` | `2734`    |
| BNI      | `bni`  | `7295`    |

Pengecualiannya `… dengan Transaksi GoPay Tabungan`, yang masuk ke akun bernama `GoPay Tabungan` (huruf besar/kecil dan awalan `Kantong` diabaikan). Kalau akun itu tidak ada, transaksinya masuk ke akun dari `account`.

Dengan cara ini, Fynlo tidak perlu tabel atau pengaturan akun default baru. Mengganti akun cukup dengan mengubah Shortcut.

Kalau tidak ada akun yang cocok, atau cocok lebih dari satu, statusnya `unmatched`. Seperti di ingest email, pesan itu bisa di-retry setelah akunnya diperbaiki.

## Transfer antar akun sendiri

Satu transfer muncul sebagai dua notifikasi: `Transaksi Berhasil! … Rp800.000` dari satu bank, dan `{kamu} telah mengirim Rp800.000 ke kamu` di Jago. Keduanya harus menjadi satu transfer, bukan satu expense dan satu income.

- Pesan yang menyebut nama yang sama dengan nama kamu (Settings → Profile) dianggap transfer.
- Kalau sisi kedua masuk dalam 10 menit dengan nominal yang sama, pesan itu digabung ke transaksi pertama (`merged`) dan mengisi `to_account_id`-nya. Jendela waktunya sama dengan ingest email.
- Kalau sisi kedua tidak pernah masuk, transaksinya tetap satu sisi dan ditandai di Review, seperti baris "possible transfer" di import statement.

## Konfirmasi lewat import statement

Notifikasi disimpan dengan `source = 'shortcut'` dan status `review` (keputusan 5).

**Yang sudah ada sekarang:** preview import menandai baris statement sebagai duplikat kalau sudah ada transaksi non-import dengan akun, tipe, dan nominal yang sama **di hari yang sama**. Baris itu tidak ikut diimport, jadi transaksi notifikasi tidak akan terhitung dua kali.

**Yang perlu ditambah:** transaksi notifikasi yang cocok dengan baris statement tidak cukup dilewati saja. Transaksi itu harus dikonfirmasi:

- status berubah dari `review` menjadi `verified`;
- jam diganti dengan jam dari statement;
- nama dan detail diganti dari statement kalau nama dari notifikasi hanya `BNI`, `GoPay`, atau `Kartu debit Jago`;
- kategori yang sudah kamu pilih tidak diubah.

Transaksi notifikasi yang tidak cocok dengan baris mana pun setelah import (misalnya pembayaran yang dibatalkan) ditampilkan di langkah Review import, supaya kamu bisa menghapusnya.

## Kategori

Sama seperti di tempat lain: tebak dari riwayat (nama + detail), lalu dari kata kunci. Transfer tidak diberi kategori.

## Perubahan yang dibutuhkan

Sudah: parser, `ingestNotification()`, route, pencocokan akun, dan pasangan transfer antar akun sendiri. Pesan disimpan dengan `sender` = `source:account` (misalnya `jago:2734`) supaya Retry tetap tahu bank dan akunnya. Pesan notifikasi sudah ikut tampil di **Settings → Automation → Recent messages** bersama pesan email.

Belum: konfirmasi lewat import statement (`statement-service.ts`) dan panduan Shortcut.

- `ingest-parsers/notification.ts`: parser untuk format-format di atas, dengan tes untuk setiap contoh.
- `ingest-service.ts`: `ingestNotification()` di samping `ingestMessage()`. Pesan disimpan ke `t_ingest_event` dengan `source = 'notification'` (tabelnya sudah mengizinkan), `sender` = `source` (`jago`/`bni`), dan `subject` = baris pertama `msg`.
- Route `POST /ingest/notification` dengan rate limit dan pengecekan token yang sama seperti `/ingest`.
- Pencocokan akun dari field `account` (mask), dengan pengecualian kantong GoPay Tabungan. Tidak perlu migrasi.
- Settings → Automation: tampilkan pesan notifikasi di samping pesan email.
- `statement-service.ts`: saat import, transaksi `shortcut` yang cocok dikonfirmasi dan diperbarui (lihat "Konfirmasi lewat import statement"). Transaksi yang tidak cocok ditampilkan di Review import.
- `docs/iphone-shortcut.md`: cara membuat Shortcut-nya.

## Pertanyaan terbuka

Jawaban nomor 7 membahas waktu transaksi, dan sudah dicatat sebagai keputusan 7. Pertanyaan aslinya masih terbuka, jadi ditanyakan lagi di nomor 8.

| #   | Pertanyaan                                                                                                                                                                                    | Kenapa penting                                                             | Jawaban                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Bagaimana Shortcut mengambil teksnya?** iOS tidak punya pemicu otomatis "notifikasi masuk" dari aplikasi lain. Shortcut yang sekarang memakai apa untuk menghasilkan file `Attachment.txt`? | Menentukan apakah`title` dan `app` bisa ikut dikirim.                      | saya bedakan shortcutnya ada shortcut dari JAGO atau dari BNI                                                             |
| 2   | **`Kamu menarik Rp50 dari Kantong {A}`:** uangnya ke mana? Ke kantong utama, atau keluar dari Jago?                                                                                           | Menentukan apakah ini transfer antar kantong atau expense.                 | ini kayaknya better di hiraukan saja dulu kayaknya saya akan meminimalisirkan transfer antar kantong sesama aplikasi jago |
| 3   | **Aplikasi mana yang mengirim notifikasi singkat** (`Transaksi Berhasil!`, `Transaksi diterima!`, `Pembayaran … pakai QRIS`)? wondr by BNI, GoPay, atau yang lain?                            | Teksnya tidak menyebut bank, jadi akunnya ditentukan dari aplikasi.        | BNI Wondr (dari tabel format)                                                                                             |
| 4   | **Kartu kredit AMEX (`0370 13** **** …`):** diterbitkan bank apa, dan apakah sudah ada sebagai akun di Fynlo dengan `mask` berisi 4 digit terakhirnya?                                        | Notifikasi kartu dicocokkan ke akun lewat 4 digit tersebut.                | untuk transaksi kartu kredit tolong dio hiraukan saja                                                                     |
| 5   | **Status di Review:** apakah transaksi dari notifikasi menunggu di Review seperti email, atau langsung tersimpan sebagai terkonfirmasi?                                                       | Review memberi kesempatan memperbaiki tebakan yang salah sebelum dihitung. | untuk melakukan confirm transaction kita lakukan dengan melakukan import statement aja                                    |
| 6   | **Pembayaran tanpa merchant** (kartu debit Jago, GoPay): apakah nama `Kartu debit Jago` / `GoPay` sudah cukup?                                                                                | Teksnya tidak menyebut uangnya dibayarkan ke mana                          | cukup                                                                                                                     |
| 7   | **`Kamu telah melakukan transfer … ke {nama}` ke orang lain:** selalu expense, atau kadang ke rekening kamu sendiri dengan nama lain?                                                         | Menentukan kapan transfer ke sebuah nama dihitung sebagai transfer.        | untuk menentukan waktunya better diambil dari datetime now saja                                                           |
| 8   | **(Ulang dari no. 7)** `Kamu telah melakukan transfer … ke {nama}`: kalau `{nama}` orang lain, apakah selalu expense? Atau ada rekeningmu sendiri yang atas nama lain?                         | Transfer ke nama sendiri dicatat sebagai transfer, bukan expense.          | yes                                                                                                                       |
| 9   | **Akun default:** untuk Shortcut Jago, transaksi masuk ke akun mana (misalnya Utama)? Untuk Shortcut BNI, akun BNI yang mana?                                                                  | Notifikasi tidak menyebut rekening, jadi akunnya diambil dari default ini. | BNI 7295, Jago 2734                                                                                                       |
