-- Coming Soon gate. New databases start open; the existing store row starts closed
-- so shoppers see the "Coming Soon" page until an Admin turns it off.
ALTER TABLE "site_config" ADD COLUMN "comingSoon" BOOLEAN NOT NULL DEFAULT false;
UPDATE "site_config" SET "comingSoon" = true;
