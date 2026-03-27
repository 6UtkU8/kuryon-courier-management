# Kuryon - Deployment Ready Setup

Bu repository `ASP.NET Core Web API` backend icindir. Frontend Angular projesi bu yapida `../kuryon-panel` klasorundadir.

## Proje Yapisi

- `Kuryon.API/` -> Backend API
- `../kuryon-panel/` -> Angular panel frontend

## Development Calistirma

### Backend (API)

```powershell
cd c:\Users\Utku\Desktop\Kuryon.API
dotnet restore
dotnet build
dotnet run
```

- Varsayilan development ayarlari: `appsettings.Development.json`
- Development seed sadece `Features:EnableDevelopmentSeedData=true` ve environment development ise calisir.

### Frontend (Angular)

```powershell
cd c:\Users\Utku\Desktop\kuryon-panel
npm install
npm start
```

- Development API URL: `src/environments/environment.development.ts`

## Production Build / Publish

### Tek Komut Release Script

```powershell
cd c:\Users\Utku\Desktop\Kuryon.API
powershell -ExecutionPolicy Bypass -File .\release.ps1
```

Script sirayla backend restore/build/publish ve frontend install/build adimlarini calistirir, sonra kritik cikti dosyalarini dogrular:

- Backend publish klasoru ve `web.config`
- Frontend dist/browser klasoru, `web.config`, `runtime-config.js`

### Backend Publish

```powershell
cd c:\Users\Utku\Desktop\Kuryon.API
dotnet restore
dotnet build -c Release
dotnet publish -c Release -o .\publish\backend
```

Alternatif publish profile:

```powershell
dotnet publish -c Release /p:PublishProfile=FolderProfile
```

- Cikti klasoru: `Kuryon.API/publish/backend`
- IIS icin publish cikisinda `web.config` otomatik uretilir.

### Frontend Build

```powershell
cd c:\Users\Utku\Desktop\kuryon-panel
npm install
npm run build -- --configuration production
```

- Cikti klasoru: `kuryon-panel/dist/kuryon-panel`
- `public/web.config` dosyasi dist cikisina dahil edilir ve SPA refresh rewrite icin kullanilir.

## Production Oncesi Doldurulacak Alanlar

Backend (`appsettings.Production.json`):

- `ConnectionStrings:DefaultConnection` -> gerçek SQL Server bilgileri
- `Jwt:Key` -> en az 32 karakter guclu secret (**PLACEHOLDER DEGISTIRILMELI**)
- `Jwt:Issuer` -> production API domain
- `Jwt:Audience` -> production frontend domain
- `Cors:AllowedOrigins` -> production panel domain(leri)

Frontend:

- `src/environments/environment.prod.ts` icindeki `apiUrl` ve `apiBaseUrl`
- `public/runtime-config.js` icindeki `apiBaseUrl` (opsiyonel runtime override)

## Kisa Release Checklist

- Production connection string girildi mi
- JWT key placeholder kaldirildi mi ve guclu deger mi
- `Cors:AllowedOrigins` gercek domain ile guncellendi mi
- Swagger production'da kapali mi (`Features:EnableSwagger=false`)
- Test endpointleri kapali mi (`Features:EnableTestEndpoints=false`)
- Development seed production'da kapali mi (`Features:EnableDevelopmentSeedData=false`)
- Frontend prod API URL localhost disi dogru domain mi
- EF migration production veritabanina uygulandi mi

Daha detayli adimlar icin `DEPLOY.md` dosyasini kullan.
