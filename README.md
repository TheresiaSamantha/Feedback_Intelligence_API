# Feedback Intelligence Dashboard

Aplikasi fullstack untuk mengelola feedback pengguna dengan enrichment AI.

Project ini terdiri dari:

- Backend API (Express) untuk CRUD feedback
- AI enrichment (Google Gemini) untuk sentiment, category, dan action summary
- Frontend (React + Vite) untuk submit, lihat, update status, dan hapus feedback
- Penyimpanan data lokal berbasis file JSON (tanpa database)

## Fitur Utama

### Backend

- POST /feedback: membuat feedback baru + trigger AI enrichment
- GET /feedback: mengambil semua feedback
- PATCH /feedback/:id: update status (open, in-progress, resolved)
- DELETE /feedback/:id: menghapus feedback

### Frontend

- Form submit feedback baru
- List feedback lengkap dengan field hasil AI
- Status toggle: open -> in-progress -> resolved
- Loading indicator saat proses AI berlangsung
- Tombol delete per item

## Data Model

Setiap item feedback memiliki struktur:

```json
{
  "id": "string-uuid",
  "text": "raw feedback text",
  "status": "open | in-progress | resolved",
  "sentiment": "positive | negative | neutral",
  "category": "Bug | Feature | UX | Performance | Other",
  "action_summary": "one sentence recommended action"
}
```

## Struktur Folder

```text
LiveCode/
├─ client/   # Frontend React + Vite
└─ server/   # Backend Express + AI enrichment
```

## Prasyarat

- Node.js 18 atau lebih baru
- npm

## Setup dan Menjalankan Project

Jalankan langkah berikut dari root project.

### 1) Install dependency backend

```bash
cd server
npm install
```

### 2) Konfigurasi environment backend

Buat file .env di folder server:

```env
GEMINI_API_KEY=isi_api_key_anda
```

Catatan:

- Jika GEMINI_API_KEY belum diisi, backend tetap berjalan dengan nilai fallback AI.

### 3) Jalankan backend

```bash
cd server
npm start
```

Backend berjalan di:

- http://localhost:3000

### 4) Install dependency frontend

```bash
cd client
npm install
```

### 5) Jalankan frontend

```bash
cd client
npm run dev
```

Frontend biasanya berjalan di:

- http://localhost:5173

## Konfigurasi API Frontend (Opsional)

Secara default frontend memanggil API ke:

- http://localhost:3000

Jika backend Anda berjalan di URL lain, buat file .env di folder client:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Build Frontend

```bash
cd client
npm run build
```

## Contoh Request API

### Create Feedback

```bash
curl -X POST http://localhost:3000/feedback \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Checkout di mobile terasa lambat\"}"
```

### Update Status

```bash
curl -X PATCH http://localhost:3000/feedback/{id} \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"in-progress\"}"
```

### Delete Feedback

```bash
curl -X DELETE http://localhost:3000/feedback/{id}
```

## Catatan Penyimpanan Data

Data feedback disimpan pada file:

- server/feedback.json

Karena tidak menggunakan database, data akan tetap lokal pada file tersebut.

## Troubleshooting Singkat

- Frontend error saat menjalankan npm start:
  - Gunakan npm run dev (karena project frontend memakai Vite)
- CORS atau request gagal:
  - Pastikan backend aktif di port 3000
- AI enrichment tidak muncul:
  - Periksa GEMINI_API_KEY pada server/.env
