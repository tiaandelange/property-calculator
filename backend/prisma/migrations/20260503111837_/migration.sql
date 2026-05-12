-- No-op: the original migration dropped camelCase bond columns that are only created
-- later (20260504120000). Fresh applies failed on the shadow database (P3006).
-- Bond finance columns are added with correct @map names in 20260504120000.

SELECT 1;
