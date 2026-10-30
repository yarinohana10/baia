-- Size guides: one per audience (Women / Men / Kids), shown on /size-guide/<slug> and in the
-- product-page size-guide dialog of the categories linked to them.

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "sizeGuideId" TEXT;

-- CreateTable
CREATE TABLE "size_guides" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "introHe" TEXT,
    "introEn" TEXT,
    "imageUploadId" TEXT,
    "imageAltHe" TEXT,
    "imageAltEn" TEXT,
    "tables" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "tips" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "size_guides_slug_key" ON "size_guides"("slug");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_sizeGuideId_fkey" FOREIGN KEY ("sizeGuideId") REFERENCES "size_guides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_guides" ADD CONSTRAINT "size_guides_imageUploadId_fkey" FOREIGN KEY ("imageUploadId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting content (prisma/data/size-guides.json); edited afterwards in Admin -> Size guides.
INSERT INTO "size_guides" ("id", "slug", "nameHe", "nameEn", "introHe", "introEn", "imageAltHe", "imageAltEn", "tables", "steps", "tips", "sortOrder", "updatedAt") VALUES ('size-guide-women', 'women', 'נשים', 'Women', 'כל המידות בסנטימטרים. מדדו ישירות על הגוף עם סרט מדידה רך, בלי למתוח.', 'All measurements are in centimetres. Measure directly on your body with a soft tape, without pulling it tight.', 'איך מודדים: חזה, מתחת לחזה, מותניים וירכיים', 'How to measure: bust, underbust, waist and hips', '[{"titleEn": "Tops — cup size", "titleHe": "חלק עליון — מידת קאפ", "columns": ["XS", "S", "M", "L", "XL", "XXL"], "rows": [{"labelEn": "Cup", "labelHe": "קאפ", "values": ["A", "B", "C", "D", "DD", "E"]}]}, {"titleEn": "Bottoms — EU size", "titleHe": "חלק תחתון — מידה אירופית", "columns": ["XS", "S", "M", "L", "XL", "XXL"], "rows": [{"labelEn": "EU", "labelHe": "EU", "values": ["32", "34", "36", "38", "40", "42"]}]}, {"titleEn": "Body measurements", "titleHe": "מידות גוף", "noteEn": "All measurements in cm", "noteHe": "כל המידות בס״מ", "columns": ["XS", "S", "M", "L", "XL", "XXL"], "rows": [{"labelEn": "Bust", "labelHe": "חזה", "values": ["76–81", "81–88", "88–92", "92–97", "97–102", "102–107"]}, {"labelEn": "Underbust", "labelHe": "מתחת לחזה", "values": ["68–73", "71–76", "76–81", "81–86", "86–91", "91–96"]}, {"labelEn": "Cup", "labelHe": "קאפ", "values": ["A+B", "B+C", "C+D", "D+DD", "DD+E", "E+F"]}, {"labelEn": "Waist", "labelHe": "מותניים", "values": ["64–68", "68–72", "72–77", "78–83", "84–88", "88–92"]}, {"labelEn": "Hips", "labelHe": "ירכיים", "values": ["84–88", "88–92", "92–96", "96–100", "100–104", "104–108"]}]}]'::jsonb, '[{"titleEn": "Bust", "titleHe": "חזה", "bodyEn": "Measure around the fullest part of your bust.", "bodyHe": "מדדו סביב החלק המלא ביותר של החזה."}, {"titleEn": "Underbust", "titleHe": "מתחת לחזה", "bodyEn": "Measure directly under your bust.", "bodyHe": "מדדו ישירות מתחת לחזה."}, {"titleEn": "Waist", "titleHe": "מותניים", "bodyEn": "Measure around the narrowest part of your waist.", "bodyHe": "מדדו סביב החלק הצר ביותר של המותניים."}, {"titleEn": "Hips", "titleHe": "ירכיים", "bodyEn": "Measure around the fullest part of your hips and seat.", "bodyHe": "מדדו סביב החלק הרחב ביותר של הירכיים והישבן."}]'::jsonb, '[{"en": "Use a soft measuring tape. Keep it level and snug without pressing into the skin.", "he": "השתמשו בסרט מדידה רך. שמרו עליו ישר וצמוד, בלי ללחוץ על העור."}, {"en": "Measure in centimetres.", "he": "מדדו בסנטימטרים."}, {"en": "Your top and bottom sizes may differ.", "he": "מידת החלק העליון ומידת החלק התחתון יכולות להיות שונות."}]'::jsonb, 0, CURRENT_TIMESTAMP);
INSERT INTO "size_guides" ("id", "slug", "nameHe", "nameEn", "introHe", "introEn", "imageAltHe", "imageAltEn", "tables", "steps", "tips", "sortOrder", "updatedAt") VALUES ('size-guide-men', 'men', 'גברים', 'Men', 'כל המידות בסנטימטרים. מדדו ישירות על הגוף עם סרט מדידה רך, בלי למתוח.', 'All measurements are in centimetres. Measure directly on your body with a soft tape, without pulling it tight.', NULL, NULL, '[{"titleEn": "Body measurements", "titleHe": "מידות גוף", "noteEn": "All measurements in cm", "noteHe": "כל המידות בס״מ", "columns": ["XS", "S", "M", "L", "XL", "XXL"], "rows": [{"labelEn": "Waist", "labelHe": "מותניים", "values": ["71–76", "76–81", "81–86", "86–94", "94–102", "102–110"]}, {"labelEn": "Hips", "labelHe": "ירכיים", "values": ["86–91", "91–96", "96–101", "101–106", "106–111", "111–116"]}, {"labelEn": "Chest", "labelHe": "היקף חזה", "values": ["84–89", "89–94", "94–99", "99–104", "104–109", "109–116"]}]}]'::jsonb, '[{"titleEn": "Waist", "titleHe": "מותניים", "bodyEn": "Measure around the narrowest part of your waist, about 2–3 cm above the belly button.", "bodyHe": "מדדו סביב החלק הצר ביותר של המותניים, בערך 2–3 ס״מ מעל הטבור."}, {"titleEn": "Hips", "titleHe": "ירכיים", "bodyEn": "Stand with your feet together and measure around the widest part of your hips and seat.", "bodyHe": "עמדו עם רגליים צמודות ומדדו סביב החלק הרחב ביותר של הירכיים והישבן."}, {"titleEn": "Inseam", "titleHe": "אורך פנימי", "bodyEn": "For swim shorts: measure along the inside of your leg, from the crotch to where you''d like the shorts to end.", "bodyHe": "למכנסי ים: מדדו לאורך הצד הפנימי של הרגל, מהמפשעה ועד הנקודה שבה תרצו שהמכנס ייגמר."}, {"titleEn": "Chest", "titleHe": "היקף חזה", "bodyEn": "Measure around the widest part of your chest, just under the armpits.", "bodyHe": "מדדו סביב החלק הרחב ביותר של בית החזה, מתחת לבתי השחי."}]'::jsonb, '[{"en": "Use a soft measuring tape. Keep it level and snug without pressing into the skin.", "he": "השתמשו בסרט מדידה רך. שמרו עליו ישר וצמוד, בלי ללחוץ על העור."}, {"en": "Between sizes? For swim shorts go by your waist, and size up for a looser fit.", "he": "בין שתי מידות? במכנסי ים בחרו לפי המותניים, ולגזרה רפויה יותר עלו מידה."}]'::jsonb, 1, CURRENT_TIMESTAMP);
INSERT INTO "size_guides" ("id", "slug", "nameHe", "nameEn", "introHe", "introEn", "imageAltHe", "imageAltEn", "tables", "steps", "tips", "sortOrder", "updatedAt") VALUES ('size-guide-kids', 'kids', 'ילדים', 'Kids', 'כל המידות בסנטימטרים. מדדו ישירות על הגוף עם סרט מדידה רך, בלי למתוח.', 'All measurements are in centimetres. Measure directly on the body with a soft tape, without pulling it tight.', NULL, NULL, '[{"titleEn": "Body measurements", "titleHe": "מידות גוף", "noteEn": "All measurements in cm", "noteHe": "כל המידות בס״מ", "columns": ["2Y", "4Y", "6Y", "8Y", "10Y", "12Y", "14Y"], "rows": [{"labelEn": "Height", "labelHe": "גובה", "values": ["86–92", "98–104", "110–116", "122–128", "134–140", "146–152", "158–164"]}, {"labelEn": "Chest", "labelHe": "היקף חזה", "values": ["51–53", "54–56", "57–60", "61–64", "65–69", "70–75", "76–81"]}, {"labelEn": "Waist", "labelHe": "מותניים", "values": ["50–51", "52–53", "54–56", "57–59", "60–62", "63–65", "66–69"]}]}]'::jsonb, '[{"titleEn": "Height", "titleHe": "גובה", "bodyEn": "Stand barefoot with your back against a wall and measure from the floor to the top of the head.", "bodyHe": "עמדו יחפים עם הגב צמוד לקיר, ומדדו מהרצפה ועד קודקוד הראש."}, {"titleEn": "Chest", "titleHe": "היקף חזה", "bodyEn": "Measure around the widest part of the chest, just under the armpits.", "bodyHe": "מדדו סביב החלק הרחב ביותר של בית החזה, מתחת לבתי השחי."}, {"titleEn": "Waist", "titleHe": "מותניים", "bodyEn": "Measure around the narrowest part of the waist.", "bodyHe": "מדדו סביב החלק הצר ביותר של המותניים."}]'::jsonb, '[{"en": "Use a soft measuring tape. Keep it level and snug without pressing into the skin.", "he": "השתמשו בסרט מדידה רך. שמרו עליו ישר וצמוד, בלי ללחוץ על העור."}, {"en": "Between sizes? Size up so it still fits next summer.", "he": "בין שתי מידות? עלו מידה כדי שיתאים גם בקיץ הבא."}]'::jsonb, 2, CURRENT_TIMESTAMP);

-- Link the top-level categories (subcategories inherit from their parent).
UPDATE "categories" SET "sizeGuideId" = 'size-guide-women' WHERE "slug" = 'women' AND "parentId" IS NULL;
UPDATE "categories" SET "sizeGuideId" = 'size-guide-men' WHERE "slug" = 'men' AND "parentId" IS NULL;
UPDATE "categories" SET "sizeGuideId" = 'size-guide-kids' WHERE "slug" IN ('children', 'kids') AND "parentId" IS NULL;
