-- Adult size set: add 3XL, 4XL and 5XL after XXL (sizes an admin already added are not repeated).
UPDATE "size_sets"
SET "sizes" = "sizes" || ARRAY(
      SELECT s FROM unnest(ARRAY['3XL', '4XL', '5XL']) WITH ORDINALITY AS t(s, i)
      WHERE NOT (s = ANY("sizes"))
      ORDER BY i
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'adult-letter';

-- Keep the built-in name in step (a renamed set keeps its custom name).
UPDATE "size_sets" SET "nameHe" = 'מבוגרים (XS–5XL)', "nameEn" = 'Adult (XS–5XL)'
WHERE "key" = 'adult-letter' AND "nameEn" = 'Adult (XS–XXL)';
