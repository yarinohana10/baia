-- Business phone / WhatsApp: replace the placeholder defaults, and fix rows still on them.
ALTER TABLE "site_config" ALTER COLUMN "businessPhone" SET DEFAULT '054-4446739';
ALTER TABLE "site_config" ALTER COLUMN "accessibilityCoordinatorPhone" SET DEFAULT '054-4446739';
ALTER TABLE "site_config" ALTER COLUMN "whatsappNumber" SET DEFAULT '972544446739';
UPDATE "site_config" SET "businessPhone" = '054-4446739' WHERE "businessPhone" = '050-0000000';
UPDATE "site_config" SET "accessibilityCoordinatorPhone" = '054-4446739' WHERE "accessibilityCoordinatorPhone" = '050-0000000';
UPDATE "site_config" SET "whatsappNumber" = '972544446739' WHERE "whatsappNumber" = '972500000000';
-- The business inbox migration only matched the old placeholder; repeat it for any row it missed.
UPDATE "site_config" SET "contactEmail" = 'baiaswimwear0@gmail.com' WHERE "contactEmail" = 'hello@baia-swimwear.co.il';
UPDATE "site_config" SET "accessibilityCoordinatorEmail" = 'baiaswimwear0@gmail.com' WHERE "accessibilityCoordinatorEmail" = 'hello@baia-swimwear.co.il';
