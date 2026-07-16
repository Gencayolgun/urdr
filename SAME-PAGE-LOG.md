# SAME-PAGE-LOG.md — Urðr

## Round 1

### Integrator findings (Codex, verbatim)
(bkz. Same Page Meeting round 1 çıktısı — 48 bulgu, tamamı [FIX] veya [KILL] veya [CLARIFY], neredeyse hiç [DEFER] yok. Tam liste bu conversation'ın geçmişinde duruyor, burada özetlenmiyor çünkü hepsi PLAN v2'ye işlendi.)

### Visionary response (Fable)

Neredeyse TÜM bulgular kabul edildi — Codex'in gerekçeleri teknik olarak sağlam, reddedilecek bir şey bulamadım. Üç en önemli, plan mimarisini değiştiren kabul:

1. **KABUL (kritik mimari düzeltme) — Rock 7 sıralaması:** "Ne baştan ne sondan" — schema/migrator + stable-ID + idempotent import erken kurulmalı (uyumluluk katmanı), SONRA lint/search/compiler bu event-log'u kullanacak şekilde taşınmalı, MCP paketleme EN SONA. Rock 7 artık tek bir "sona bırakılan büyük rock" değil, PLAN v2'de kademeli alt-adımlara bölündü (Rock 6, 5 alt-aşama).
2. **KABUL (kritik teknik düzeltme) — Heartbeat senkron writer'da çalışmaz:** Node'un tek-thread event loop'unda, senkron blocking I/O sırasında bir timer callback'i (heartbeat) ateşlenemez. Owner-token fikri kalıyor ama "heartbeat" yerine OS-tabanlı kilit (flock benzeri) veya ayrı bir lease-keeper process gerekiyor. Rock 1'e işlendi.
3. **KABUL (mimari sadeleştirme) — Tek paylaşılan parser modülü:** Rock 1 (eski)'in 3 ayrı dosyada (search/append/lint) ayrı ayrı regex yamalamak yerine, TEK bir kanonik Markdown parser/leaf-grammar modülü (multi-line yorumlar, gerçek leaf sınırları — continuation/nested-list/table/blockquote/code-fence, EN+TR placeholder) yazılıp append/search/lint/migrate/bench/event-log-import'un HEPSİ bunu kullanması gerekiyor. Bu, Rock 7'nin Markdown-import ihtiyacıyla da doğrudan örtüşüyor — YENİ Rock 0 olarak öne alındı.

Diğer kabul edilen, plana işlenen düzeltmeler (özet — detaylar PLAN v2'de):
- Path-traversal: substring "../" reddi YETERSİZ, realpath-tabanlı confinement gerekiyor (symlink/absolute-path/case-trick bypass'larını da kapatır).
- Header-injection: blanket "##" reddi meşru içeriği kırar, sadece parser'ın TANIDIĞI heading node'ları (code-fence dışında) reddedilmeli.
- migrate.sh: sed/awk yerine Node'a taşınıp Rock 0'ın parser'ını kullanmalı; `move` komutu hedef dal parametresi almalı (şu anki arayüz eksik); `new-root` dinamik olarak bir sonraki boş root numarasını bulmalı (root-4 hardcode değil); `split` non-interactive/plan-file modu almalı (CI'da test edilebilir olsun).
- init.sh: `--lang both` iki paralel "gerçek" ağaç yaratıp single-primary-truth kuralını bozuyor — dil sadece sunum/isimlendirme tercihi olmalı, TEK birincil ağaç + alias'lar.
- check-growth.sh: KILL — tamamen kaldırılıyor (Codex'in kendi önerisi, zaten deprecated).
- CI: blanket "warning'de de fail" yerine açık `--fail-on-warn` politikası + golden-fixture/snapshot testleri.
- Cross-root duplicate: O(n²) pairwise yerine token-index candidate generation; referans/bkz: leaf'lerini duplicate sanmaması için hariç tutulmalı.
- Arama: varsayılan LİTERAL (regex değil) — hem ReDoS riskini varsayılan olarak ortadan kaldırır hem basitleştirir; regex sadece açık, sınırlı, doğrulanmış bir modda.
- Türkçe morfoloji: generic "typo tolerance" yeterli değil, gerçek Türkçe ek/kök farkındalığı gerekiyor.
- Benchmark: ground truth stable-ID'lerle kurulmalı (query başına benzersiz anahtar yerine), "hierarchy-only" iddiası gerçekten SADECE ilgili dosyanın okunduğunu enstrümante ederek kanıtlanmalı.
- Telemetri: varsayılan KAPALI + hash'lenmiş/minimize edilmiş + gitignore'da + rotate ediliyor + "hiç secret loglanmıyor" testi.
- Memory-compiler: dry-run planı input hash'ine bağlanmalı, plan üretildikten sonra ağaç değiştiyse "stale" reddedilmeli.
- MCP: realpath confinement + symlink reddi + sınırlı input/output + explicit tool schema + adversarial client testleri + gerçek paket manifesti/lock/protokol testi/clean-install testi.

**REDDEDİLEN:** Yok — bulguların hepsi teknik olarak haklıydı.

PLAN.md v2'ye işlendi (Rock 0 yeni eklendi, Rock 7 kademeli alt-adımlara bölündü, tüm diğer rock'lar spesifik düzeltmelerle güncellendi).

## Round 2

### Integrator findings (Codex, verbatim)
(19 bulgu, neredeyse tamamı BLOCKING — özet: yürütme sırası hâlâ açık değildi, Rock 0 "transaction layer" içermiyordu ama Rock 2 ona bağımlıydı, event-log otoritesi ile serbest Markdown düzenleme arasındaki gerilim çözülmemişti, "proper-lockfile" örneği reddedilen heartbeat sorununu geri getiriyordu, regex zaman sınırı aynı thread'de işe yaramaz, `--lang both` hâlâ belirsizdi, provenance/forgetting/auto-split detayları eksikti.)

### Visionary response (Fable)

TÜMÜ kabul edildi, kesin kararlar verildi:

1. **KABUL — Açık yürütme sırası:** `0 → 1 → 6A → 2/3/4 → 6B → 5 → 6C → 6D`. 6A (şema + stable-ID + TRANSACTION API) artık Rock 2/3'ten ÖNCE, çünkü ikisi de ona bağımlı.
2. **KABUL — Transaction primitive'i 6A'ya taşındı**, Rock 0 sadece parser kalıyor.
3. **KARAR — Event-log otoritesi vs serbest Markdown düzenleme:** Markdown dosyaları DOĞRUDAN düzenlenebilir kalıyor (projenin temel değer önerisi bu). 6A'ya "reconciliation import" komutu eklendi: son event-log checkpoint'inden beri yapılan doğrudan düzenlemeleri diff'leyip yeni event'lere çevirir, eşzamanlı çakışmayı (aynı leaf hem event-log hem doğrudan düzenlenmiş) tespit edip kullanıcıya sorar. Bidirectional ama "otomatik sessiz senkron" değil, "tespit et + sor" modeli.
4. **KABUL — Round-trippable stable ID'ler**, HTML yorumu içinde (`<!-- id:abc123 -->`), eski araçlar görmezden gelir.
5. **KARAR — Manifest atomikliği SADECE event-log-farkında okuyucular için** — mevcut ajanlar (Claude Code vb.) doğrudan `root-*.md` dosyalarını okuduğu için TAM çoklu-dosya atomikliği bu okuyucular için garanti EDİLEMEZ, bu açıkça dokümante edilen bir sınırlama olarak kabul edildi (yeniden tasarlamak yerine).
6. **KABUL — Phase B artık append/migrate/compiler/init'in HEPSİNİ event-log-farkında yazıcı yapıyor**, sadece lint/search değil.
7. **KARAR — Kilit mekanizması: GERÇEK OS-seviyeli kilit (flock-benzeri native binding) VEYA bağımsız zamanlanmış bir lease-keeper ALT-PROCESS** — "proper-lockfile" örneği KALDIRILDI (varsayılan renewal mekanizması reddedilen heartbeat'le aynı sorunu taşıyor).
8. **KARAR — `--lang both` TAMAMEN KALDIRILDI.** Tek ağaç, tek isimlendirme dili. En basit tasarım.
9. **KABUL — Regex güvenliği: ayrı, sonlandırılabilir bir worker/subprocess'te çalıştırılıyor** (aynı-thread timeout işe yaramıyor) VEYA RE2-tarzı sınırlı motor.
10. **KABUL — Telemetri varsayılan olarak sorgu-türevi değer SAKLAMIYOR** (sadece agregate sayaçlar); sorgu-özel veri gerekiyorsa açık, anahtarlı ve rotate edilen pseudonymization.
11. **KABUL — Forgetting'in silme sınırı TÜM türevleri kapsıyor** (backup, eski generation'lar, telemetri, temp dosyalar, hash-chain checkpoint'leri).
12. **KABUL — Auto branch-splitting (madde 25) compiler gereksinimlerine geri eklendi** (deterministic clustering + evidence/confidence + golden fixture + onay-sonrası uygulama).
13. **KABUL — Provenance şeması açıkça listelendi:** creator, timestamp, source, confidence, verification state, verifier, validity interval.
14. **KABUL — MCP proof artık her tool'u (search/append/lint/compiler/forgetting) test client üzerinden GERÇEKTEN çağırıyor**, sadece handshake değil, negative security case'ler dahil.
15. **CLARIFY çözümü — Hermes/NatureCo lazy-loading:** Yeni bir şema İCAT EDİLMİYOR — build sırasında `integrations/hermes/skill.yaml` ve `integrations/natureco/plugin.yaml`'ın MEVCUT şeması okunup o şemanın İZİN VERDİĞİ ölçüde on-demand yükleme uygulanıyor (execution-detail, Codex build sırasında karar verir).
16. **KABUL — Platform-özel metadata garantileri** (mode/ACL) ayrı ayrı tanımlanıyor, tek bir "portable" iddia yok. **KABUL — Fault-injection noktaları** açıkça listelendi: fsync öncesi, rename öncesi, rename sonrası, dizin-fsync öncesi, manifest-pointer yayını sırasında.

**REDDEDİLEN:** Yok.

PLAN.md v3'e işlendi.
