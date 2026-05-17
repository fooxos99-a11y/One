# فصل site-1 و site-2 على نفس VPS

هذا الدليل يجعل الموقع الأول والموقع الثاني منفصلين بالكامل من ناحية:

- رقم واتساب
- جلسة واتساب
- ملفات الجلسة والـ QR
- عمليات التشغيل على الـ VPS
- المنفذ الداخلي والخارجي

## الفصل المطلوب

### site-1

- env: `deploy/vps/sites/site-1/site.env`
- app port: `3001`
- public port on same IP: `8081`
- worker identity: `WHATSAPP_INSTANCE_SLUG=site-1`
- client id: `WHATSAPP_CLIENT_ID=habib-site-1`
- worker state id: `WHATSAPP_WORKER_STATE_SETTING_ID=whatsapp_worker_state_site_1`
- worker command id: `WHATSAPP_WORKER_COMMAND_SETTING_ID=whatsapp_worker_command_site_1`
- state files: `/var/www/habib/shared/site-1/...`

### site-2

- env: `deploy/vps/sites/site-2/site.env`
- app port: `3002`
- public port on same IP: `8082`
- worker identity: `WHATSAPP_INSTANCE_SLUG=site-2`
- client id: `WHATSAPP_CLIENT_ID=habib-site-2`
- worker state id: `WHATSAPP_WORKER_STATE_SETTING_ID=whatsapp_worker_state_site_2`
- worker command id: `WHATSAPP_WORKER_COMMAND_SETTING_ID=whatsapp_worker_command_site_2`
- state files: `/var/www/habib/shared/site-2/...`

## النتيجة

بهذا الترتيب:

- الموقع الأول لا يقرأ أو يكتب أي ملفات تخص الموقع الثاني
- الموقع الثاني لا يقرأ أو يكتب أي ملفات تخص الموقع الأول
- كل موقع له QR مستقل
- كل موقع يجب أن يربط رقم واتساب مختلف

## تشغيل العمليات على نفس الخادم

```bash
cd /var/www/habib/app
pm2 start ./scripts/vps/run-site.sh --name habib-site1-app --interpreter /bin/bash -- app ./deploy/vps/sites/site-1/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site1-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-1/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site2-app --interpreter /bin/bash -- app ./deploy/vps/sites/site-2/site.env
pm2 start ./scripts/vps/run-site.sh --name habib-site2-worker --interpreter /bin/bash -- worker ./deploy/vps/sites/site-2/site.env
pm2 save
```

## أمر إنقاذ سريع للموقعين

إذا تعطل الباركود في الموقعين أو توقف أحد الـ workers، شغّل هذا الأمر من داخل الخادم:

```bash
cd /var/www/habib/app
bash ./scripts/vps/recover-whatsapp-sites.sh
```

هذا الأمر يقوم بـ:

- تشغيل أو إعادة تشغيل `site-1-app`
- تشغيل أو إعادة تشغيل `site-1-worker`
- تشغيل أو إعادة تشغيل `site-2-app`
- تشغيل أو إعادة تشغيل `site-2-worker`
- طباعة `pm2 ls`
- عرض آخر سجلات عمال واتساب للموقعين

## تفعيل nginx على نفس الـ IP

### site-1

```bash
cp /var/www/habib/app/deploy/vps/sites/site-1/nginx.same-vps.conf /etc/nginx/sites-available/habib-site1
ln -s /etc/nginx/sites-available/habib-site1 /etc/nginx/sites-enabled/habib-site1
```

### site-2

```bash
cp /var/www/habib/app/deploy/vps/sites/site-2/nginx.same-vps.conf /etc/nginx/sites-available/habib-site2
ln -s /etc/nginx/sites-available/habib-site2 /etc/nginx/sites-enabled/habib-site2
```

ثم:

```bash
nginx -t
systemctl reload nginx
```

## الوصول الخارجي

- site-1: `http://167.86.113.166:8081`
- site-2: `http://167.86.113.166:8082`

## أهم شرط للفصل التام

حتى مع كل هذا العزل، إذا ربطت الموقعين بنفس رقم واتساب فلن يتحقق الفصل الذي تريده.

يجب أن يكون:

- site-1 -> رقم واتساب أول
- site-2 -> رقم واتساب ثانٍ