# DataCell — نظّف بياناتك 📊

منصة تنظيف وتحليل البيانات للشركات السعودية الصغيرة والمتوسطة.

> **Clean your data. Understand your numbers. In seconds.**

---

## المميزات

- 📂 **رفع ملفات CSV / Excel** — drag & drop أو اختيار يدوي
- 🔍 **كشف المشاكل تلقائياً** — قيم فارغة، تكرار، أخطاء تنسيق
- ✨ **تنظيف بنقرة واحدة** — تنظيف شامل فوري
- 📊 **لوحة تحليلات متكاملة** — مخططات، insights، مقارنة أعمدة
- 🤖 **AI Chat** — اسأل عن بياناتك بالعربي أو الإنجليزي
- 📤 **تصدير** — CSV نظيف أو PDF تقرير احترافي
- 🌙 **RTL / عربي-إنجليزي** — دعم كامل للغتين
- 🔒 **Client-side 100%** — بياناتك لا تغادر جهازك (PDPL compliant)

---

## تشغيل المشروع محلياً

```bash
# 1. تثبيت المتطلبات
npm install

# 2. تشغيل بيئة التطوير
npm run dev

# 3. بناء للإنتاج
npm run build
```

---

## هيكل المشروع

```
datacell/
├── index.html              # الصفحة الرئيسية
├── public/
│   ├── favicon.svg
│   └── opengraph.jpg
├── src/
│   ├── styles/
│   │   └── main.css        # كل التصميم
│   └── lib/
│       └── datacell.js     # كل منطق التطبيق
├── package.json
├── vite.config.js
├── vercel.json             # إعدادات Vercel
└── .gitignore
```

---

## النشر على Vercel

1. ارفع المشروع على GitHub
2. اذهب إلى [vercel.com](https://vercel.com) وسجّل دخول
3. اختر **New Project** → استورد الـ repo
4. Vercel يكتشف إعدادات Vite تلقائياً → اضغط **Deploy**

---

## التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| Vanilla JS | منطق التطبيق كامل |
| SheetJS (xlsx.js) | قراءة ملفات Excel/CSV |
| CSS Variables | نظام التصميم |
| Tajawal Font | الخط العربي |
| Vite | build tool |

---

## الترخيص

© 2026 DataCell. جميع الحقوق محفوظة.
