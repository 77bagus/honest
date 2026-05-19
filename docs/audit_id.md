# Audit Framework HonestJS & Roadmap Masa Depan

Dokumen ini memberikan audit komprehensif terhadap framework HonestJS, mengidentifikasi potensi masalah, celah arsitektural, dan peta jalan (roadmap) untuk fitur masa depan yang terinspirasi oleh standar industri seperti NestJS.

## 📋 Daftar Periksa (Checklist) Audit Framework

### Arsitektur Inti & Modul
- [x] **Modul Dinamis:** Saat ini `@Module()` bersifat statis. Kurangnya pola `register()`, `forRoot()`, atau `forFeature()` untuk konfigurasi runtime.
- [x] **Enkapsulasi Modul (Exports):** Kurangnya properti `exports` pada `ModuleOptions`. Saat ini, semua layanan yang terdaftar di modul mana pun secara efektif bersifat publik setelah di-resolve.
- [x] **Circular Dependencies:** Terdeteksi tetapi tidak dapat di-resolve. Kurangnya utilitas `forwardRef()` untuk menangani sirkularitas antar-modul atau antar-layanan.
- [x] **Lifecycle Hooks:** Tidak ada dukungan untuk `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`, atau `BeforeApplicationShutdown`.
- [x] **Async Providers:** Provider di-resolve secara sinkron. Kurang dukungan `useFactory` dengan `async/await`.
- [x] **Factory Providers:** Belum ada pola provider formal `useFactory`, `useValue`, atau `useExisting`.
- [ ] **Dependency Graph:** Tidak ada cara bawaan untuk memvisualisasikan atau memeriksa graf dependensi saat startup.

### Dependency Injection (DI)
- [ ] **Injection Scopes:** Hanya scope Singleton yang didukung. Kurang scope `Request` dan `Transient`.
- [ ] **Property Injection:** Saat ini hanya mendukung constructor injection. Kurang dekorator `@Inject()` untuk properti.
- [x] **Token String/Symbol:** DI tampaknya terbatas pada constructor kelas sebagai token. Tidak ada dukungan untuk token berbasis string atau symbol.
- [ ] **Multi-instance Providers:** Tidak ada dukungan untuk provider `multi: true` (misalnya, untuk mendaftarkan beberapa plugin ke satu token).

### Pipeline (Middleware, Guards, Pipes, Filters)
- [x] **Interceptors:** Belum ada lapisan Interceptor untuk urusan cross-cutting (transformasi respons, pemetaan stream, dll.).
- [ ] **Granularitas Pipeline Global:** Global guards/pipes/filters diterapkan ke semua rute. Kurang logika untuk mengecualikan rute tertentu dari komponen global.
- [x] **Execution Context:** Pipeline meneruskan `Context` milik Hono. Kurang `ExecutionContext` tingkat framework yang menyediakan metadata tentang kelas dan handler yang sedang dipanggil.
- [x] **Native Validation Pipe:** Belum ada pipe validasi bawaan yang terintegrasi dengan `class-validator` atau `zod`.
- [ ] **Prioritas Filter:** Urutan prioritas tidak jelas untuk beberapa exception filter.

### Routing & Controller
- [ ] **Versioning Header/Media-Type:** Saat ini hanya versioning berbasis URI yang ditangani secara eksplisit.
- [ ] **Logika Versioning:** Tidak ada dukungan untuk versioning "Neutral" yang default ke versi terbaru.
- [ ] **Redirect Decorator:** Kurang dekorator `@Redirect()` untuk pengalihan deklaratif.
- [ ] **Render Decorator:** Kurang dekorator `@Render()` untuk integrasi template engine.
- [ ] **Dukungan SSE:** Tidak ada dukungan asli untuk Server-Sent Events melalui dekorator.

### Observabilitas & DX (Developer Experience)
- [ ] **Swagger/OpenAPI:** Belum ada pembuatan spek OpenAPI bawaan atau berbasis plugin.
- [ ] **Logger Injection:** Tidak ada cara mudah untuk menyuntikkan logger framework ke dalam layanan pengguna.
- [x] **Diagnostik:** Meskipun ada beberapa log debug, tidak ada mode "Inspector" untuk pemantauan real-time.
- [ ] **Pesan Kesalahan:** Kesalahan circular dependency bisa lebih deskriptif tentang jalur siklusnya.

### Ekosistem & Fitur Lanjutan
- [x] **Modul Konfigurasi:** Belum ada cara resmi untuk menangani konfigurasi hierarkis dan file `.env`.
- [ ] **File Upload:** Tidak ada dekorator asli `@UploadedFile()` atau `@UploadedFiles()` untuk penanganan multipart.
- [ ] **Websockets:** Tidak ada dukungan untuk Socket.io atau WebSocket asli melalui dekorator.
- [ ] **Microservices:** Tidak ada lapisan transport untuk TCP, Redis, NATS, dll.
- [ ] **Task Scheduling:** Belum ada dekorator Cron atau interval bawaan.
- [ ] **Event Emitter:** Tidak ada bus event internal untuk komunikasi yang terlepas (decoupled).
- [ ] **Modul Cache:** Kurang abstraksi caching standar.
- [ ] **Health Checks:** Belum ada dukungan bawaan untuk Terminus atau endpoint pemeriksaan kesehatan.
- [ ] **CLI:** Kurangnya alat scaffolding untuk membuat kode boilerplate.

---

## 🚀 Rekomendasi Rencana Pengembangan

### Fase 1: Kekokohan Inti (Jangka Pendek) - ✅ SELESAI
1. [x] **Lifecycle Hooks:** Implementasikan `OnModuleInit` and `OnApplicationBootstrap` untuk memungkinkan layanan melakukan inisialisasi (misalnya, koneksi DB).
2. [x] **Resolusi Circular Dependency:** Perkenalkan `forwardRef()` untuk menangani rantai dependensi yang kompleks.
3. [x] **Module Exports:** Implementasikan enkapsulasi dalam `@Module` untuk membatasi visibilitas layanan.
4. [x] **Provider yang Ditingkatkan:** Tambahkan dukungan untuk `useValue` dan `useFactory` (sinkron).

### Fase 2: Pipeline & DX (Jangka Menengah) - 🚧 SEDANG BERJALAN
1. [x] **Interceptors:** Tambahkan lapisan Interceptor ke `PipelineExecutor`.
2. [x] **Async Providers:** Aktifkan dukungan `async` untuk `useFactory`.
3. [x] **Validation Pipe:** Buat `ZodValidationPipe` atau `ClassValidatorPipe asli.
4. [x] **Modul Konfigurasi:** Kembangkan paket `@honestjs/config`.
5. [ ] **Logger Injection:** Izinkan `@InjectLogger()` atau injeksi standar untuk logger framework.

### Fase 3: Ekspansi Ekosistem (Jangka Panjang) - ⏳ AKAN DATANG
1. [ ] **Integrasi Swagger:** Otomatiskan pembuatan spesifikasi OpenAPI 3.0.
2. [ ] **Request Scoping:** Implementasikan scope `Request` dalam kontainer DI.
3. [ ] **Websockets & SSE:** Tambahkan dukungan komunikasi real-time.
4. [ ] **Alat CLI:** Kembangkan `honest-cli` untuk prototyping cepat.

## 🐛 Peta Jalan Perbaikan Bug
1. [ ] **Tabrakan Metadata:** Pastikan `MetadataRegistry` (statis) tidak menyebabkan masalah di lingkungan multi-app di mana kelas yang sama mungkin memerlukan metadata berbeda.
2. [x] **Kebocoran Memori:** Verifikasi metode `clear()` di registry bersifat tuntas dan dipanggil saat aplikasi dimatikan.
3. [x] **Penanganan Error di Filter:** Pastikan jika filter melempar error, hal itu tidak merusak seluruh pipeline melainkan jatuh ke global error handler.
