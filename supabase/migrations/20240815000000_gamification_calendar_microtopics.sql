-- Gamification: XP + Badges
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges_select" ON user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_badges_insert" ON user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Academic Calendar
CREATE TABLE IF NOT EXISTS academic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'outro',
  target_group TEXT NOT NULL DEFAULT 'all',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE academic_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academic_events_select" ON academic_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "academic_events_insert" ON academic_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "academic_events_update" ON academic_events FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "academic_events_delete" ON academic_events FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_academic_events_date ON academic_events(event_date);

-- Micro-topics
CREATE TABLE IF NOT EXISTS micro_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, name)
);

ALTER TABLE micro_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "micro_topics_select" ON micro_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "micro_topics_insert" ON micro_topics FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS micro_topic_id UUID REFERENCES micro_topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questions_micro_topic_id ON questions(micro_topic_id);
