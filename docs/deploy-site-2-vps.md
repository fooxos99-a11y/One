# نشر الموقع الثاني على VPS مستقل

هذا الدليل يشغّل `site-2` من هذا المجلد المحلي مباشرة على VPS مستقل.

## الملفات المحلية المستخدمة

- `deploy/vps/sites/site-2/site.env`
- `deploy/vps/sites/site-2/nginx.conf`
- `scripts/vps/run-site.sh`

## 1. جهّز ملف المتغيرات

افتح الملف المحلي التالي واملأ القيم الناقصة:

- `deploy/vps/sites/site-2/site.env`

الحقول التي يجب تعبئتها قبل التشغيل:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SESSION_SECRET`
- `SESSION_SECRET`
- `NEXTAUTH_SECRET`
- `CRON_SECRET`

مهم:

- هذا الملف محلي ومُتجاهل من git.
- لا تعيد استخدام أي مسار واتساب من موقع آخر.
- لا تعيد استخدام أي secret من موقع آخر.

## 2. ارفع المشروع إلى VPS الثاني

يمكنك رفع المشروع كملفات مباشرة إلى أي مسار ثابت، مثال:

```bash
mkdir -p /var/www/habib
```

ثم ضع المشروع داخل:

```bash
/var/www/habib/app
```

ويجب أن يصل ملف env إلى هذا المسار على الخادم:

```bash
/var/www/habib/app/deploy/vps/sites/site-2/site.env
```

## 3. تثبيت المتطلبات على VPS الثاني

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

## 4. تثبيت الحزم وبناء المشروع

```bash
cd /var/www/habib/app
pnpm install
pnpm build
chmod +x ./scripts/vps/run-site.sh
```

## 5. تشغيل التطبيق والواتساب

```bash
cd /var/www/habib/app
pm2 start ./scripts/vps/run-site.sh --name habib-site2-app --interpreter /bin/bash -- app ./deploy/vps/sites/site-2/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site2-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-2/site.env
pm2 save
pm2 startup
```

## 6. إعداد Nginx

انسخ الملف المحلي التالي إلى الخادم:

- `deploy/vps/sites/site-2/nginx.conf`

واجعله مثلًا هنا:

```bash
/etc/nginx/sites-available/habib-site2
```

ثم فعّله:

```bash
ln -s /etc/nginx/sites-available/habib-site2 /etc/nginx/sites-enabled/habib-site2
nginx -t
systemctl reload nginx
```

إذا كنت تستخدم IP بدل دومين، عدّل `server_name` داخل ملف nginx قبل التفعيل.

## 7. التحقق بعد التشغيل

```bash
pm2 status
pm2 logs habib-site2-app --lines 100
pm2 logs habib-site2-worker --lines 100
curl http://127.0.0.1:3002/api/whatsapp/status
```

ولعرض QR من المتصفح بعد ربط nginx:

```text
http://YOUR_SERVER/api/whatsapp/qr
```

## 8. إعادة التشغيل والصيانة

```bash
pm2 restart habib-site2-app
pm2 restart habib-site2-worker
pm2 stop habib-site2-app
pm2 stop habib-site2-worker
```

## 9. ملاحظات العزل

- `APP_PORT=3002` خاص بهذا الموقع فقط.
- `WHATSAPP_INSTANCE_SLUG=site-2` و `WHATSAPP_CLIENT_ID=habib-site-2` خاصان بهذا الموقع فقط.
- المسارات تحت `/var/www/habib/shared/site-2/` يجب أن تبقى غير مشتركة مع أي موقع آخر.