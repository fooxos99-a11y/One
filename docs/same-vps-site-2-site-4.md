# تشغيل site-2 و site-4 على نفس VPS ونفس IP

إذا كان الموقعان على نفس الخادم `167.86.113.166` فالفصل يكون على 3 مستويات:

## 1. فصل العمليات

ملف [ecosystem.vps.config.cjs](c:/Users/wajeh/Desktop/sites/4-main/ecosystem.vps.config.cjs) يشغّل عمليتين منفصلتين لكل موقع:

- `habib-site2-app`
- `habib-site2-worker`
- `habib-site4-app`
- `habib-site4-worker`

## 2. فصل الملفات والجلسات

في [deploy/vps/sites/site-2/site.env](c:/Users/wajeh/Desktop/sites/4-main/deploy/vps/sites/site-2/site.env) الموقع الثاني يستخدم:

- `APP_PORT=3002`
- `WHATSAPP_INSTANCE_SLUG=site-2`
- `WHATSAPP_CLIENT_ID=habib-site-2`
- `/var/www/habib/shared/site-2/...`

والموقع الرابع يجب أن يبقى على:

- `APP_PORT=3004`
- `WHATSAPP_INSTANCE_SLUG=site-4`
- مسارات `site-4`

بهذا لن تختلط جلسات واتساب أو QR أو ملفات الحالة.

## 3. فصل الوصول الخارجي

لأن الموقع الرابع يستخدم `80` على نفس الـIP، فالموقع الثاني يحتاج أحد حلين:

1. دومين أو subdomain مستقل على نفس المنفذ `80`
2. أو منفذ خارجي مختلف على نفس الـIP

إذا كنت تريد نفس الـIP بدون دومين إضافي، استخدم هذا الملف:

- [deploy/vps/sites/site-2/nginx.same-vps.conf](c:/Users/wajeh/Desktop/sites/4-main/deploy/vps/sites/site-2/nginx.same-vps.conf)

هذا سيعرض الموقع الثاني على:

- `http://167.86.113.166:8082`

بينما يبقى الموقع الرابع على:

- `http://167.86.113.166`

## أوامر التشغيل على الخادم

```bash
cd /var/www/habib/app
pm2 start ./scripts/vps/run-site.sh --name habib-site2-app --interpreter /bin/bash -- app ./deploy/vps/sites/site-2/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site2-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-2/site.env
pm2 save
```

## أوامر تفعيل nginx للموقع الثاني على نفس الـIP

```bash
cp /var/www/habib/app/deploy/vps/sites/site-2/nginx.same-vps.conf /etc/nginx/sites-available/habib-site2
ln -s /etc/nginx/sites-available/habib-site2 /etc/nginx/sites-enabled/habib-site2
nginx -t
systemctl reload nginx
```

## التحقق

```bash
pm2 status
curl http://127.0.0.1:3002/api/whatsapp/status
curl http://167.86.113.166:8082/api/whatsapp/status
```