-- Business inbox: replace the placeholder default, and fix rows still on it.
ALTER TABLE "site_config" ALTER COLUMN "contactEmail" SET DEFAULT 'baiaswimwear0@gmail.com';
ALTER TABLE "site_config" ALTER COLUMN "accessibilityCoordinatorEmail" SET DEFAULT 'baiaswimwear0@gmail.com';
UPDATE "site_config" SET "contactEmail" = 'baiaswimwear0@gmail.com' WHERE "contactEmail" = 'hello@baia-swimwear.co.il';
UPDATE "site_config" SET "accessibilityCoordinatorEmail" = 'baiaswimwear0@gmail.com' WHERE "accessibilityCoordinatorEmail" = 'hello@baia-swimwear.co.il';
