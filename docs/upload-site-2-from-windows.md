# رفع وتشغيل site-2 من ويندوز إلى VPS مباشر

هذا الدليل يستخدم هذا المجلد المحلي فقط، ثم يرفعه إلى VPS الثاني مباشرة من جهازك.

## 1. عدّل القيم المحلية أولاً

املأ ملف المتغيرات التالي محليًا:

- `deploy/vps/sites/site-2/site.env`

وتأكد من تعبئة هذه القيم على الأقل:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SESSION_SECRET`
- `SESSION_SECRET`
- `NEXTAUTH_SECRET`
- `CRON_SECRET`

## 2. اضغط المشروع محليًا

من PowerShell داخل المجلد الرئيسي للمشروع:

```powershell
Compress-Archive -Path * -DestinationPath site-2-deploy.zip -Force
```

إذا كان حجم الملف كبيرًا بسبب ملفات غير مهمة، احذف أولًا أي مجلدات محلية غير مطلوبة مثل:

- `.next`
- `node_modules`

## 3. ارفع الملف إلى VPS

مثال إذا كان اسم المستخدم `root` وIP هو `YOUR_VPS_IP`:

```powershell
scp .\site-2-deploy.zip root@YOUR_VPS_IP:/var/www/habib/
```

## 4. فك الضغط على الخادم

بعد الدخول إلى VPS:

```bash
ssh root@YOUR_VPS_IP
cd /var/www/habib
rm -rf app
mkdir -p app
apt install -y unzip
unzip site-2-deploy.zip -d app
cd app
```

## 5. ثبت المتطلبات وابن المشروع

```bash
apt update
apt install -y nginx chromium
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm pm2
pnpm install
pnpm build
chmod +x ./scripts/vps/run-site.sh
```

## 6. شغّل الموقع والواتساب

```bash
pm2 start ./scripts/vps/run-site.sh --name habib-site2-app --interpreter /bin/bash -- app ./deploy/vps/sites/site-2/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site2-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-2/site.env
pm2 save
pm2 startup
```

## 7. فعّل Nginx

انسخ الملف التالي إلى إعدادات nginx:

- `deploy/vps/sites/site-2/nginx.conf`

مثال:

```bash
cp /var/www/habib/app/deploy/vps/sites/site-2/nginx.conf /etc/nginx/sites-available/habib-site2
ln -s /etc/nginx/sites-available/habib-site2 /etc/nginx/sites-enabled/habib-site2
nginx -t
systemctl reload nginx
```

إذا كنت ستستخدم IP مباشر، غيّر `server_name` داخل الملف قبل النسخ.

## 8. التحقق

```bash
pm2 status
pm2 logs habib-site2-app --lines 100
pm2 logs habib-site2-worker --lines 100
curl http://127.0.0.1:3002/api/whatsapp/status
```

## 9. التحديث لاحقًا

كلما عدلت هذا المجلد محليًا:

1. أعد إنشاء `site-2-deploy.zip`
2. ارفعه إلى VPS
3. فك الضغط فوق المشروع
4. نفّذ:

```bash
cd /var/www/habib/app
pnpm install
pnpm build
pm2 restart habib-site2-app
pm2 restart habib-site2-worker
```