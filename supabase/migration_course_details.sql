-- 강좌 상세 정보 컬럼 추가
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS what_you_learn  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requirements    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS instructor_name TEXT,
  ADD COLUMN IF NOT EXISTS instructor_bio  TEXT;
