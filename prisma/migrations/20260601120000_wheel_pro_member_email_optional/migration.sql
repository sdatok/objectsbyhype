-- Ensure empty string default for optional email (safe if column is still NOT NULL).
ALTER TABLE "WheelProMember" ALTER COLUMN "email" SET DEFAULT '';
UPDATE "WheelProMember" SET "email" = '' WHERE "email" IS NULL;
