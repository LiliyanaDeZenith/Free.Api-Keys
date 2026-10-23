# Luxyne Vault - Free API Keys

Frontend: React + TypeScript + Vite. Backend: Go (tanpa dependency, cukup stdlib).

## Jalankan

```bash
# terminal 1
cd backend
go run .            # http://localhost:8080

# terminal 2
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Produksi: `npm run build` di frontend, lalu `go run .` di backend. Go otomatis menyajikan `frontend/dist` di port 8080.

## Setup awal

1. Edit `backend/.env`: ganti `ADMIN_USER`, `VIP_CODES`, dan isi key asli.
2. Daftar di web dengan username sama seperti `ADMIN_USER` (daftar duluan) supaya jadi admin.
3. Key asli dipasang di `.env` per API, banyak key dipisah koma (key pool):
   `KEYS_GROQ=gsk_aaa,gsk_bbb`. Nama variabel = `KEYS_` + id API huruf besar (lihat `catalog()` di `handlers/key.go`).
   Tanpa key asli, kartu memakai placeholder `REPLACE_ME_<ID>`.
4. Key bisa juga ditambah lewat tab Admin tanpa restart.

## Cara kerja singkat

- Key tidak pernah dikirim ke browser sebelum user menekan Buka Vault. Kuota: Free 5 key/hari, VIP 50 key/hari, reset 00:00 WIB.
- Streak login 7 hari = 1 VIP Pass (buka 1 key VIP ONLY). Kode invite VIP ada di `VIP_CODES`.
- Health check tiap 5 menit: ping tiap API, key yang ditolak (401/403) otomatis dilewati.
- Anti abuse: IP yang lebih dari 120 request/menit diblokir 10 menit, maksimal 5 akun baru per IP per hari.
- Data user dan key tambahan disimpan di `backend/data.json`. Jangan di-push.
- Di belakang reverse proxy (nginx dsb) set `TRUST_PROXY=1` agar IP asli terbaca.
- Password di-hash SHA-256 + salt + 50.000 putaran. Untuk skala besar ganti ke bcrypt/argon2.
