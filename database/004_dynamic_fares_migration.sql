
-- 4Mi dynamic fares migration
-- Back up the database before running this script.

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS passenger_count
SMALLINT NOT NULL DEFAULT 1;

-- Mark rides with zero fare as requiring fare discussion.
UPDATE rides
SET fare_status = 'TO_BE_DISCUSSED'
WHERE estimated_fare = 0;

-- Mark rides with positive fares as quoted.
UPDATE rides
SET fare_status = 'QUOTED'
WHERE estimated_fare > 0
  AND (fare_status IS NULL OR fare_status = '');
