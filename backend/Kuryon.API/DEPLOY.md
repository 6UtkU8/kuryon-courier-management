# DEPLOY GUIDE (IIS + Standard Hosting)

## Hızlı Release (Tek Komut)

```powershell
cd c:\Users\Utku\Desktop\Kuryon.API
powershell -ExecutionPolicy Bypass -File .\release.ps1
```

Bu script backend + frontend release adimlarini calistirir ve kritik cikti dosyalarini otomatik dogrular.

---

## 1) Production Config Hazirligi

`Kuryon.API/appsettings.Production.json` dosyasini deploy oncesi mutlaka guncelle:

- `ConnectionStrings:DefaultConnection`
- `Jwt:Key` (**PLACEHOLDER KULLANMA**)
- `Jwt:Issuer`
- `Jwt:Audience`
- `Cors:AllowedOrigins`

Oneri: Hassas ayarlari (JWT key, DB password) ortam degiskeni veya secret store ile ver.

---

## 2) Backend Release Akisi

```powershell
cd c:\Users\Utku\Desktop\Kuryon.API
dotnet restore
dotnet build -c Release
dotnet publish -c Release -o .\publish\backend
```

Alternatif:

```powershell
dotnet publish -c Release /p:PublishProfile=FolderProfile
```

### Backend Cikti

- `Kuryon.API/publish/backend`
- IIS'e bu klasor deploy edilir.

### IIS Notlari (Backend)

- Sunucuda **ASP.NET Core Hosting Bundle** kurulu olmali.
- IIS site veya application olarak publish cikisini gosterecek sekilde ayarlanir.
- Proxy arkasinda (`X-Forwarded-*`) calisacak sekilde API ayarlandi.
- Production'da exception detayi istemciye donmez, sadece genel hata mesaji ve trace id doner.

---

## 3) Frontend Release Akisi

```powershell
cd c:\Users\Utku\Desktop\kuryon-panel
npm install
npm run build -- --configuration production
```

### Frontend Cikti

- `kuryon-panel/dist/kuryon-panel`

Bu klasor statik hosting (IIS/Nginx/CDN) icin uygundur.

### IIS Notlari (Frontend SPA)

- `public/web.config` ile Angular route refresh rewrite kurali eklendi.
- Dist icinde `web.config` oldugunu dogrula.
- API URL:
  - sabit: `environment.prod.ts`
  - runtime override: `runtime-config.js`

---

## 4) Migration / Database Release

API deployundan once veya hemen sonra migration uygula:

```powershell
cd c:\Users\Utku\Desktop\Kuryon.API
dotnet ef database update --configuration Release
```

Notlar:

- Uygulama startup'ta `Database.Migrate()` cagiriyor; yine de kontrollu release icin `dotnet ef database update` adimi onerilir.
- Seed sadece development environment + feature flag aktifse calisir.
- Production'da demo/test seed varsayilan olarak kapali.

---

## 5) Runtime Guvenlik ve Loglama

- Production log seviyesi warning/error odakli.
- Swagger varsayilan kapali (`Features:EnableSwagger=false`).
- Test endpointleri varsayilan kapali.
- CORS listesi bos ise production startup hata verir (yanlis deploy'u erken yakalar).
- JWT key production'da guclu degilse startup hata verir.

---

## 6) Final Production Checklist

- [ ] `appsettings.Production.json` placeholder alanlari dolduruldu
- [ ] DB connection production serveri isaret ediyor
- [ ] JWT key guclu ve gizli kaynaktan geliyor
- [ ] `Cors:AllowedOrigins` gercek domainlerle guncellendi
- [ ] Swagger production'da kapali
- [ ] Test endpointleri kapali
- [ ] Development seed kapali
- [ ] Frontend `environment.prod.ts` API URL dogru
- [ ] `runtime-config.js` gerekiyorsa production API URL ile guncellendi
- [ ] Migration production database'e uygulandi
- [ ] Backend publish cikisi IIS'e yuklendi
- [ ] Frontend dist cikisi statik hosta yuklendi
