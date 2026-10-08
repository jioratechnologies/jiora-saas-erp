-- The API used to auto-create a full-permission "Service Account" user for ANY unrecognised sign-in.
-- That blocked invited people from claiming their invite (their identity was already taken by the stub)
-- and gave them admin-level access. Auto-creation is gone; clear the stubs it left behind so the real
-- invite can be claimed on the person's next sign-in. Machine accounts that are genuinely needed are
-- re-created automatically once their subject is listed in ZITADEL_SERVICE_ACCOUNT_SUBJECTS.
DELETE FROM persons WHERE email LIKE 'service-%@zitadel.service.local';
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'service-%@zitadel.service.local');
DELETE FROM users WHERE email LIKE 'service-%@zitadel.service.local';
