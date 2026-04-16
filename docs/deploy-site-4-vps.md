# نشر الموقع الرابع على VPS واحد

هذا الدليل يشغّل `site-4` على VPS مع إبقاء عامل واتساب يعمل دائمًا عبر `pm2`.

إذا كان التطبيق نفسه مستضافًا على `Vercel`، فلا تحتاج إلى تشغيل `habib-site4-app` على الـ VPS. يكفي تشغيل `habib-site4-worker` فقط، بشرط أن يستخدم نفس مشروع `Supabase` ونفس `WHATSAPP_WORKER_STATE_SETTING_ID` و `WHATSAPP_WORKER_COMMAND_SETTING_ID` الموجودة في Vercel.

## بيانات الخادم

- `IP`: `167.86.113.166`
- التطبيق سيعمل داخليًا على المنفذ `3004`
- يفضّل عرض الموقع خارجيًا عبر `nginx` على المنفذ `80` أو الدومين لاحقًا

## 1. أول دخول إلى الخادم

من جهازك المحلي:

```bash
ssh root@167.86.113.166
```

مهم:

- غيّر كلمة المرور مباشرة بعد أول دخول
- يفضّل إضافة `SSH key` وإيقاف الاعتماد على كلمة المرور لاحقًا

## 2. تثبيت المتطلبات

نفّذ على الـ VPS:

```bash
apt update
apt install -y git nginx chromium
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm pm2
```

تحقق:

```bash
node -v
pnpm -v
pm2 -v
chromium --version
```

## 3. رفع المشروع إلى الخادم

اختر مجلد تشغيل ثابت:

```bash
mkdir -p /var/www/habib
cd /var/www/habib
```

إذا كنت سترفعه عبر Git:

```bash
git clone <REPO_URL> app
cd /var/www/habib/app
```

إذا كنت سترفعه يدويًا من جهازك، ضع الملفات داخل:

```bash
/var/www/habib/app
```

## 4. نقل ملف البيئة الخاص بالموقع الرابع

الملف الفعلي `site.env` محلي فقط ومُهمل من git، لذلك ابدأ من القالب التالي:

- `deploy/vps/sites/site-4/site.env.example`

ثم انسخه أو أعد تسميته على الخادم إلى:

```bash
/var/www/habib/app/deploy/vps/sites/site-4/site.env
```

ملاحظة:

- مفاتيح `Supabase` وأسرار الجلسة تم تجهيزها محليًا
- إذا كنت ستستخدم `Web Push` أو `WhatsApp Cloud API` لاحقًا، أكمل الحقول placeholder قبل الإنتاج الكامل

## 5. تثبيت الحزم وبناء المشروع

على الـ VPS داخل المشروع:

```bash
cd /var/www/habib/app
pnpm install
pnpm build
chmod +x ./scripts/vps/run-site.sh
```

## 6. تشغيل الموقع وعامل واتساب عبر PM2

إذا كنت تشغّل التطبيق كاملًا على الـ VPS:

```bash
cd /var/www/habib/app
pm2 start ./scripts/vps/run-site.sh --name habib-site4-app --interpreter /bin/bash -- app ./deploy/vps/sites/site-4/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site4-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-4/site.env
pm2 save
pm2 startup
```

إذا كان التطبيق على `Vercel` وتريد فقط عامل واتساب على الـ VPS:

```bash
cd /var/www/habib/app
pm2 start ./scripts/vps/run-site.sh --name habib-site4-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-4/site.env
pm2 save
pm2 startup
```

تحقق من الحالة:

```bash
pm2 status
pm2 logs habib-site4-worker
```

إذا كان التطبيق على `Vercel`، افحص من الخارج بعد تشغيل العامل:

```bash
curl https://one-teal-xi.vercel.app/api/whatsapp/status
```

يجب أن تتغير قيمة `workerOnline` إلى `true` خلال ثوانٍ إذا كانت إعدادات `Supabase` ومعرّفات حالة العامل متطابقة بين Vercel والـ VPS.

## 7. إعداد Nginx

أنشئ ملف إعداد:

```bash
nano /etc/nginx/sites-available/habib-site4
```

وضع هذا المحتوى:

```nginx
server {
  listen 80;
  server_name 167.86.113.166;

  location / {
    proxy_pass http://127.0.0.1:3004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection upgrade;
  }
}
```

ثم فعّل الإعداد:

```bash
ln -s /etc/nginx/sites-available/habib-site4 /etc/nginx/sites-enabled/habib-site4
nginx -t
systemctl reload nginx
```

## 8. فحص واتساب

بعد تشغيل العامل، تحقق:

```bash
curl http://127.0.0.1:3004/api/whatsapp/status
```

وللوصول إلى QR من المتصفح:

```text
http://167.86.113.166/api/whatsapp/qr
```

## 9. أوامر الصيانة

إعادة تشغيل:

```bash
pm2 restart habib-site4-app
pm2 restart habib-site4-worker
```

إيقاف مؤقت:

```bash
pm2 stop habib-site4-app
pm2 stop habib-site4-worker
```

متابعة السجلات:

```bash
pm2 logs habib-site4-app --lines 100
pm2 logs habib-site4-worker --lines 100
```