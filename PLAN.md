# PLAN.md — Urðr: tüm bulguları düzelt + tüm önerileri uygula (v3, Same Page Meeting round 2 sonrası)

**Core Focus:** ISSUES.md'deki TÜM bug'ları düzelt ve TÜM önerilen özellikleri uygula, testleri yaz/çalıştır.

## ⚙️ KESİN YÜRÜTME SIRASI (round 2'de netleşti)

```
Rock 0 → Rock 1 → Rock 6A → (Rock 2, Rock 3, Rock 4 paralel) → Rock 6B → Rock 5 → Rock 6C → Rock 6D
```

Rock 6A (event-log şeması + stable-ID + TRANSACTION API) Rock 2/3'ten ÖNCE gelir çünkü ikisi de ona bağımlı (migrate.mjs transaction API'sini kullanır, lint'in referans graf kontrolü stable-ID'lere dayanır).

---

## Rock 0 — Paylaşılan Markdown parser modülü

**Değişen karar (round 3):** Yorum işleme artık İKİ TÜRÜ ayırt ediyor — "Urðr metadata yorumu" (`<!-- urdr:id:... -->` gibi tanınan bir prefix'le başlayan, PARSE EDİLİP round-trip kimliği için Rock 6A'ya aktarılan) vs "sıradan yorum" (prose, yok sayılıyor). Böylece Rock 6A'nın kimlik yorumları parser tarafından asla silinmiyor.
(Diğer kısımlar değişmedi — çok satırlı yorum bloğu doğru atlanıyor, gerçek leaf sınırı, EN+TR placeholder, sadece gerçek heading node'ları tanıma.)
**Dosyalar:** YENİ `scripts/lib/markdown-model.mjs`

## Rock 1 — Concurrency & durability

**Değişen karar (round 2):** Kilit mekanizması **proper-lockfile GİBİ bir örnek DEĞİL** — ya gerçek bir OS-seviyeli kilit (native binding, platforma göre flock/LockFileEx) ya da renewal'ı ANA writer'ın event loop'undan TAMAMEN bağımsız, ayrı zamanlanmış bir lease-keeper ALT-PROCESS. Renewal mekanizmasının "bloke olan writer'ın kendi timer'ına" bağımlı OLMADIĞI açıkça test ediliyor.
Fault-injection noktaları açıkça listeleniyor: fsync öncesi, rename öncesi, rename sonrası, dizin-fsync öncesi.
Platform-özel metadata garantileri (mode/ACL) ayrı ayrı tanımlanıyor (tek "portable" iddia yok, Windows'ta hangi garantinin verilmediği dokümante ediliyor).
(Diğer kısımlar değişmedi — realpath confinement, parser-farkında header-injection reddi.)
**Dosyalar:** `scripts/append.mjs`, YENİ `scripts/lib/lock.mjs`

## Rock 6A — Event-log şeması + stable-ID + transaction API (ÖNE ALINDI, round 3 ile tamamlandı)

**Done looks like:**
- `.urdr/events.jsonl`: kanonik serialization, hash-chaining, commit record'ları, kesilme kurtarma, fsync davranışı.
- Şema versiyonlama + idempotent Markdown import (round-trippable stable ID'ler, HTML yorumu içinde `<!-- urdr:id:abc123 -->` — Rock 0'ın parser'ı bu prefix'i "Urðr metadata yorumu" olarak tanıyıp KORUYOR, sıradan yorumlardan ayırıyor, bkz. Rock 0) — duplicate/reorder/edit/export/re-import senaryoları test edilir.
- **`bkz:` kenar şeması:** referanslar artık stable-ID'ye işaret eden yapılandırılmış kenarlar olarak saklanıyor (Markdown'da hâlâ okunabilir `bkz:` metni görünür, altında ID-tabanlı kenar var); legacy serbest-metin referansların ID-tabanlı kenara migration'ı test ediliyor.
- **Reconciliation import komutu:** son checkpoint'ten beri yapılan doğrudan Markdown düzenlemelerini diff'leyip yeni event'lere çevirir; aynı leaf hem event-log hem doğrudan düzenlenmişse ÇAKIŞMA olarak işaretler, kullanıcıya sorar (sessiz otomatik senkron YOK). Markdown dosyaları DOĞRUDAN düzenlenebilir kalır.
- **Dirty-view gate:** publish öncesi mevcut view'ın son checkpoint'ten beri değiştiği kontrol ediliyor; değiştiyse reconciliation TAMAMLANMADAN publish REDDEDİLİYOR, üzerine yazılacak versiyon için kurtarma kopyası tutuluyor. Bir transaction publish'i SIRASINDA eşzamanlı yönetilmeyen düzenleme AÇIKÇA DESTEKLENMİYOR (dokümante edilen sınırlama).
- **Atomik çoklu-işlem transaction API'si** (`beginTransaction()`/`commit()`/`abort()` tarzı): cross-cutting'in "primary + birkaç bkz:" gereksinimi bunun üzerinden TEK transaction olarak yazılır.
- Çoklu-dosya yayın: manifest/pointer-swap ile atomik hale getirilir — **AMA bu atomiklik SADECE event-log-farkında okuyucular için garanti edilir.** Mevcut ajanlar doğrudan `root-*.md` okuduğu için TAM çoklu-dosya atomikliği onlar için garanti EDİLEMEZ — açıkça `protocols/architecture.md`'de dokümante edilen bir sınırlama.
**Dosyalar:** YENİ `scripts/lib/event-log.mjs`, YENİ `scripts/lib/transaction.mjs`
**Proof:** Stable ID'lerin rename/reorder sonrası kırılmadığı, transaction'ın atomik olduğu, reconciliation'ın çakışmayı doğru tespit ettiği, dirty-view gate'in beklenmedik üzerine-yazmayı engellediği testlerle gösterilir.

## Rock 2 — migrate.sh / init.sh / check-growth.sh

**Değişen karar (round 2):** `--lang both` TAMAMEN KALDIRILDI — tek ağaç, tek isimlendirme dili (en basit tasarım). `migrate.mjs` artık Rock 6A'nın transaction API'sini kullanıyor (kendi ad-hoc dosya mutasyonu değil).
(Diğer kısımlar değişmedi — check-growth.sh KILL, move'un hedef-dal parametresi, dinamik new-root numaralandırma, init.sh preflight-all-then-commit, git rev-parse --show-toplevel ile nested-repo tespiti.)
**Dosyalar:** YENİ `scripts/migrate.mjs`, `scripts/init.sh`, `scripts/check-growth.sh` (silinir)

## Rock 3 — Lint tamlığı + CI

**Değişen karar (round 2):** 2-hop `bkz:` zincir kontrolü artık Rock 6A'nın stable-ID referans grafiği üzerinden yapılıyor (serbest metin parse değil) — bu yüzden Rock 3, Rock 6A'DAN SONRA yapılır.
(Diğer kısımlar değişmedi — token-index duplicate detection, `--fail-on-warn` politikası + golden-fixture, doc-check.mjs.)
**Dosyalar:** `scripts/lint.mjs`, `.github/workflows/ci.yml`, YENİ `scripts/lib/doc-check.mjs`

## Rock 4 — Dokümantasyon + entegrasyon tutarlılığı

**Değişen karar (round 2):** Hermes/NatureCo lazy-loading için yeni bir şema İCAT EDİLMİYOR — build sırasında `integrations/hermes/skill.yaml` ve `integrations/natureco/plugin.yaml`'ın MEVCUT şeması okunup o şemanın izin verdiği ölçüde on-demand yükleme uygulanıyor (execution-detail, Codex build sırasında gerçek şemaya bakıp karar verir).
(Diğer kısımlar değişmedi.)

## Rock 6B — Mevcut araçları event-log'a taşı (GENİŞLETİLDİ)

**Değişen karar (round 2):** Sadece lint/search DEĞİL — **append, migrate, compiler, init'in HEPSİ** event-log-farkında yazıcı olacak şekilde uyarlanıyor. Aksi halde bu araçlardan biri event-log'u atlayıp doğrudan Markdown'a yazarsa "event-log otoriter kaynak" iddiası anlamsızlaşır.
**Proof:** Her mutator'ın (append/migrate/compiler/init) event-log üzerinden yazdığı, hiçbirinin onu atlamadığı testlerle gösterilir.

## Rock 5 — Retrieval kalitesi + benchmark + telemetri

**Değişen karar (round 2):**
- Regex güvenliği: **aynı-thread timeout YETERSİZ** (JS regex'in katastrofik backtracking'i kesintiye uğratılamaz) — regex ayrı, sonlandırılabilir bir worker/subprocess'te çalıştırılıyor VEYA RE2-tarzı sınırlı bir motor kullanılıyor.
- Telemetri: varsayılan olarak **sorgu-türevi HİÇBİR değer saklamıyor** (sadece "kaç sorgu hiyerarşiyle/fallback'le bulundu" gibi agregate sayaçlar) — hash'leme "secret loglanmıyor" garantisi vermediği için (düşük-entropi sözlük saldırısına açık) tamamen kaldırıldı. Sorgu-özel veri gerekiyorsa (opt-in, ayrı bir bayrak) açık, anahtarlı ve rotate edilen pseudonymization.
- Ground truth stable ID'lerle (Rock 6A) kuruluyor.
(Diğer kısımlar değişmedi.)

## Rock 6C — Zengin metadata + politika

**Değişen karar (round 2):**
- Provenance şeması AÇIKÇA: `creator, timestamp, source, confidence, verification_state, verifier, validity_interval` alanları versiyonlu şemanın parçası.
- Forgetting'in silme sınırı TÜM türevleri kapsıyor: backup'lar, eski materialized generation'lar, telemetri kayıtları, temp dosyalar, hash-chain checkpoint'leri — hiçbiri "unutulan" veriyi görünmez bırakmıyor.
- **Auto branch-splitting (audit madde 25) GERİ EKLENDİ:** deterministic keyword-clustering, evidence/confidence skoru ile, golden fixture testleri, SADECE onay sonrası uygulanıyor (compiler'ın dry-run çıktısının bir parçası).
- Memory-compiler: plan girdi-ağacı hash'ine bağlı, ağaç değiştiyse stale reddediliyor.

## Rock 6D — MCP server paketleme

**Değişen karar (round 2):** Proof artık her tool'u (search/append/lint/compiler/forgetting) test client üzerinden GERÇEKTEN çağırıyor (sadece handshake yeterli değil), negative security case'ler (path traversal, symlink, oversized input) dahil.
(Diğer kısımlar değişmedi — realpath confinement, gerçek paket manifesti/lock/clean-install testi.)

---

## Ortak proof
```
node scripts/selftest.mjs
node scripts/lint.mjs ./templates
node scripts/bench.mjs --leaves 300 --ambiguity 0.3
```

## Non-goals
Gerçek vector DB/embedding YOK. Deploy/npm publish YOK. GitHub'a push YOK.
