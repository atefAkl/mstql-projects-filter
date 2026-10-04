# دليل التطوير والتشغيل (Development & Setup Guide)

## 1. المتطلبات البيئية (Prerequisites)
- Node.js >= v18.x
- npm >= 9.x
- Windows Environment / Powershell

## 2. هيكل المجلدات (Project Directory Structure)
```
mostaql.monitor/
├── docs/                      # جميع وثائق وتصميمات المشروع المعمارية
├── src/
│   ├── core/                  # Clean Domain Entities, Interfaces & Errors
│   ├── infrastructure/        # Database repositories (SQLite), Collector Adapters
│   ├── application/           # Use cases, Schedulers, DTOs
│   ├── presentation/          # REST API Controllers & Web Server
│   └── shared/                # Utilities, Logger, Config
├── tests/                     # Unit & Integration Tests
├── package.json
├── tsconfig.json
└── README.md
```

## 3. الأوامر الأساسية (Commands)
- `npm install`: تثبيت الحزم والمكتبات.
- `npm run build`: تجميع كود TypeScript.
- `npm test`: تشغيل جميع الاختبارات المؤكدة لسلامة النظام.
- `npm run dev`: تشغيل خادم التطوير الخفي المحتوي على الـ Hot Reloading.
