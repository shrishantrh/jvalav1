// Comprehensive badge system with 100+ badges across multiple categories
export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'milestone' | 'streak' | 'consistency' | 'feature' | 'tracking' | 'insight' | 'engagement' | 'special' | 'adventure' | 'wellness' | 'social' | 'seasonal' | 'secret';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export const ALL_BADGES: Badge[] = [
  // === MILESTONE BADGES ===
  { id: 'first_log', name: 'First Log', icon: '🌟', description: 'Logged your first entry', category: 'milestone', rarity: 'common' },
  { id: 'logs_10', name: 'Getting Started', icon: '📝', description: '10 total entries', category: 'milestone', rarity: 'common' },
  { id: 'logs_25', name: 'Quarter Century', icon: '📊', description: '25 total entries', category: 'milestone', rarity: 'common' },
  { id: 'logs_50', name: 'Halfway There', icon: '⭐', description: '50 total entries', category: 'milestone', rarity: 'uncommon' },
  { id: 'logs_100', name: 'Century Club', icon: '💯', description: '100 total entries', category: 'milestone', rarity: 'uncommon' },
  { id: 'logs_250', name: 'Dedicated Logger', icon: '🏅', description: '250 total entries', category: 'milestone', rarity: 'rare' },
  { id: 'logs_500', name: 'Half Thousand', icon: '🎖️', description: '500 total entries', category: 'milestone', rarity: 'rare' },
  { id: 'logs_1000', name: 'Millennium Master', icon: '👑', description: '1000 total entries', category: 'milestone', rarity: 'epic' },
  { id: 'logs_2500', name: 'Legend', icon: '🏆', description: '2500 total entries', category: 'milestone', rarity: 'legendary' },

  // === STREAK BADGES ===
  { id: 'streak_3', name: '3-Day Streak', icon: '🔥', description: '3 days in a row', category: 'streak', rarity: 'common' },
  { id: 'streak_7', name: 'Week Warrior', icon: '💪', description: '7 days in a row', category: 'streak', rarity: 'common' },
  { id: 'streak_14', name: 'Fortnight Fighter', icon: '⚡', description: '14 days in a row', category: 'streak', rarity: 'uncommon' },
  { id: 'streak_21', name: 'Habit Builder', icon: '🧱', description: '21 days - habit formed!', category: 'streak', rarity: 'uncommon' },
  { id: 'streak_30', name: 'Monthly Master', icon: '📅', description: '30 days in a row', category: 'streak', rarity: 'rare' },
  { id: 'streak_60', name: 'Iron Will', icon: '🦾', description: '60 days straight', category: 'streak', rarity: 'rare' },
  { id: 'streak_90', name: 'Quarterly Champion', icon: '🏋️', description: '90 days - quarter year!', category: 'streak', rarity: 'epic' },
  { id: 'streak_180', name: 'Half Year Hero', icon: '🌙', description: '180 days streak', category: 'streak', rarity: 'epic' },
  { id: 'streak_365', name: 'Year of Dedication', icon: '🎊', description: 'Full year streak!', category: 'streak', rarity: 'legendary' },
  { id: 'streak_comeback', name: 'Comeback Kid', icon: '🔄', description: 'Rebuilt streak after breaking', category: 'streak', rarity: 'uncommon' },

  // === CONSISTENCY BADGES ===
  { id: 'perfect_week', name: 'Perfect Week', icon: '✨', description: 'Logged every day for a week', category: 'consistency', rarity: 'uncommon' },
  { id: 'consistency_king', name: 'Consistency King', icon: '👑', description: '80%+ logging for a month', category: 'consistency', rarity: 'rare' },
  { id: 'never_miss_monday', name: 'Never Miss Monday', icon: '🌅', description: 'Logged every Monday for a month', category: 'consistency', rarity: 'uncommon' },
  { id: 'weekend_warrior', name: 'Weekend Warrior', icon: '🎉', description: 'Logged every weekend for a month', category: 'consistency', rarity: 'uncommon' },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', description: '10 logs before 7 AM', category: 'consistency', rarity: 'uncommon' },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', description: '10 logs after 10 PM', category: 'consistency', rarity: 'uncommon' },
  { id: 'lunch_logger', name: 'Lunch Logger', icon: '🍱', description: '10 logs at noon', category: 'consistency', rarity: 'common' },
  { id: 'routine_master', name: 'Routine Master', icon: '⏰', description: 'Logged at same time 14 days', category: 'consistency', rarity: 'rare' },

  // === FEATURE BADGES ===
  { id: 'detailed_first', name: 'Detail Oriented', icon: '🔍', description: 'First detailed entry', category: 'feature', rarity: 'common' },
  { id: 'photo_first', name: 'Picture Perfect', icon: '📸', description: 'First photo log', category: 'feature', rarity: 'common' },
  { id: 'photo_10', name: 'Photographer', icon: '📷', description: '10 photo logs', category: 'feature', rarity: 'uncommon' },
  { id: 'voice_first', name: 'Voice Logger', icon: '🎤', description: 'First voice note', category: 'feature', rarity: 'common' },
  { id: 'voice_10', name: 'Podcaster', icon: '🎙️', description: '10 voice notes', category: 'feature', rarity: 'uncommon' },
  { id: 'export_pro', name: 'Export Pro', icon: '📤', description: 'First health export', category: 'feature', rarity: 'uncommon' },
  { id: 'share_master', name: 'Share Master', icon: '🔗', description: 'Shared with physician', category: 'feature', rarity: 'uncommon' },
  { id: 'ai_chatter', name: 'AI Chatter', icon: '🤖', description: '50 AI conversations', category: 'feature', rarity: 'rare' },
  { id: 'wearable_connected', name: 'Connected Life', icon: '⌚', description: 'Connected a wearable', category: 'feature', rarity: 'uncommon' },
  { id: 'custom_shortcut', name: 'Shortcut Master', icon: '⚡', description: 'Created custom shortcuts', category: 'feature', rarity: 'common' },

  // === TRACKING BADGES ===
  { id: 'symptom_tracker', name: 'Symptom Tracker', icon: '🩺', description: 'Tracked 10 different symptoms', category: 'tracking', rarity: 'uncommon' },
  { id: 'symptom_master', name: 'Symptom Master', icon: '🏥', description: 'Tracked 25 different symptoms', category: 'tracking', rarity: 'rare' },
  { id: 'trigger_detective', name: 'Trigger Detective', icon: '🔎', description: 'Logged 10 different triggers', category: 'tracking', rarity: 'uncommon' },
  { id: 'trigger_master', name: 'Trigger Master', icon: '🎯', description: 'Logged 25 different triggers', category: 'tracking', rarity: 'rare' },
  { id: 'med_tracker', name: 'Med Tracker', icon: '💊', description: 'Logged 20 medication doses', category: 'tracking', rarity: 'uncommon' },
  { id: 'med_adherent', name: 'Med Adherent', icon: '💉', description: 'Perfect med logging for a week', category: 'tracking', rarity: 'rare' },
  { id: 'energy_tracker', name: 'Energy Tracker', icon: '🔋', description: '20 energy logs', category: 'tracking', rarity: 'uncommon' },
  { id: 'mood_master', name: 'Mood Master', icon: '🎭', description: 'All mood types logged', category: 'tracking', rarity: 'rare' },
  { id: 'weather_watcher', name: 'Weather Watcher', icon: '🌤️', description: '50 weather-tagged entries', category: 'tracking', rarity: 'uncommon' },
  { id: 'location_tracker', name: 'Location Logger', icon: '📍', description: '10 different locations logged', category: 'tracking', rarity: 'uncommon' },

  // === INSIGHT BADGES ===
  { id: 'pattern_detective', name: 'Pattern Detective', icon: '🔮', description: 'Discovered first correlation', category: 'insight', rarity: 'uncommon' },
  { id: 'health_analyst', name: 'Health Analyst', icon: '📈', description: '5 correlations discovered', category: 'insight', rarity: 'rare' },
  { id: 'data_scientist', name: 'Data Scientist', icon: '🧪', description: '10 correlations discovered', category: 'insight', rarity: 'epic' },
  { id: 'insight_seeker', name: 'Insight Seeker', icon: '💡', description: 'Viewed insights 10 times', category: 'insight', rarity: 'uncommon' },
  { id: 'chart_reader', name: 'Chart Reader', icon: '📊', description: 'Viewed all chart types', category: 'insight', rarity: 'uncommon' },
  { id: 'prediction_pro', name: 'Prediction Pro', icon: '🔮', description: 'Received 5 predictions', category: 'insight', rarity: 'rare' },

  // === ENGAGEMENT BADGES ===
  { id: 'profile_complete', name: 'Profile Pro', icon: '✅', description: 'Completed profile 100%', category: 'engagement', rarity: 'common' },
  { id: 'settings_explorer', name: 'Settings Explorer', icon: '⚙️', description: 'Visited all settings', category: 'engagement', rarity: 'common' },
  { id: 'theme_changer', name: 'Theme Changer', icon: '🎨', description: 'Changed theme color', category: 'engagement', rarity: 'common' },
  { id: 'reminder_set', name: 'Reminder Set', icon: '🔔', description: 'Set up reminders', category: 'engagement', rarity: 'common' },
  { id: 'feedback_giver', name: 'Feedback Giver', icon: '💬', description: 'Gave app feedback', category: 'engagement', rarity: 'uncommon' },
  { id: 'app_veteran', name: 'App Veteran', icon: '🎖️', description: 'Using app for 30+ days', category: 'engagement', rarity: 'uncommon' },
  { id: 'power_user', name: 'Power User', icon: '⚡', description: 'Used 10+ features', category: 'engagement', rarity: 'rare' },

  // === WELLNESS BADGES ===
  { id: 'flare_free_3', name: 'Clear Skies', icon: '☀️', description: '3 days flare-free', category: 'wellness', rarity: 'common' },
  { id: 'flare_free_7', name: 'Smooth Week', icon: '🌈', description: '7 days flare-free', category: 'wellness', rarity: 'uncommon' },
  { id: 'flare_free_14', name: 'Fortnight Clear', icon: '🌻', description: '14 days flare-free', category: 'wellness', rarity: 'rare' },
  { id: 'flare_free_30', name: 'Monthly Miracle', icon: '🦋', description: '30 days flare-free', category: 'wellness', rarity: 'epic' },
  { id: 'improving_trend', name: 'Upward Bound', icon: '📈', description: 'Improving trend 2 weeks', category: 'wellness', rarity: 'uncommon' },
  { id: 'recovery_champion', name: 'Recovery Champion', icon: '🏆', description: 'Recovered from severe flare', category: 'wellness', rarity: 'rare' },
  { id: 'sleep_champion', name: 'Sleep Champion', icon: '😴', description: '7+ hours avg for a week', category: 'wellness', rarity: 'uncommon' },
  { id: 'hydration_hero', name: 'Hydration Hero', icon: '💧', description: 'Logged hydration 7 days', category: 'wellness', rarity: 'uncommon' },

  // === ADVENTURE/LOCATION BADGES ===
  { id: 'globe_trotter', name: 'Globe Trotter', icon: '🌍', description: 'Logged in 3+ countries', category: 'adventure', rarity: 'rare' },
  { id: 'world_traveler', name: 'World Traveler', icon: '✈️', description: 'Logged in 5+ countries', category: 'adventure', rarity: 'epic' },
  { id: 'road_tripper', name: 'Road Tripper', icon: '🚗', description: 'Logged in 5+ cities', category: 'adventure', rarity: 'uncommon' },
  { id: 'city_hopper', name: 'City Hopper', icon: '🏙️', description: 'Logged in 10+ cities', category: 'adventure', rarity: 'rare' },
  { id: 'nomad', name: 'Digital Nomad', icon: '🏕️', description: 'Logged from new location', category: 'adventure', rarity: 'common' },
  { id: 'beach_logger', name: 'Beach Logger', icon: '🏖️', description: 'Logged near the ocean', category: 'adventure', rarity: 'uncommon' },
  { id: 'mountain_tracker', name: 'Mountain Tracker', icon: '⛰️', description: 'Logged at high altitude', category: 'adventure', rarity: 'rare' },
  { id: 'timezone_jumper', name: 'Timezone Jumper', icon: '🌐', description: 'Logged in 3+ timezones', category: 'adventure', rarity: 'rare' },

  // === SEASONAL BADGES ===
  { id: 'new_year_logger', name: 'New Year Logger', icon: '🎆', description: 'Logged on New Year\'s Day', category: 'seasonal', rarity: 'uncommon' },
  { id: 'valentines_care', name: 'Self-Love', icon: '💝', description: 'Logged on Valentine\'s Day', category: 'seasonal', rarity: 'uncommon' },
  { id: 'spring_tracker', name: 'Spring Tracker', icon: '🌸', description: 'Active during spring', category: 'seasonal', rarity: 'common' },
  { id: 'summer_logger', name: 'Summer Logger', icon: '🌞', description: 'Active during summer', category: 'seasonal', rarity: 'common' },
  { id: 'fall_tracker', name: 'Fall Tracker', icon: '🍂', description: 'Active during fall', category: 'seasonal', rarity: 'common' },
  { id: 'winter_warrior', name: 'Winter Warrior', icon: '❄️', description: 'Active during winter', category: 'seasonal', rarity: 'common' },
  { id: 'halloween_logger', name: 'Spooky Logger', icon: '🎃', description: 'Logged on Halloween', category: 'seasonal', rarity: 'uncommon' },
  { id: 'thanksgiving_gratitude', name: 'Grateful', icon: '🦃', description: 'Logged on Thanksgiving', category: 'seasonal', rarity: 'uncommon' },
  { id: 'holiday_health', name: 'Holiday Health', icon: '🎄', description: 'Logged on Christmas', category: 'seasonal', rarity: 'uncommon' },
  { id: 'birthday_log', name: 'Birthday Logger', icon: '🎂', description: 'Logged on your birthday', category: 'seasonal', rarity: 'rare' },

  // === SECRET/SPECIAL BADGES ===
  { id: 'midnight_logger', name: 'Midnight Logger', icon: '🌙', description: 'Logged at exactly midnight', category: 'secret', rarity: 'rare' },
  { id: 'palindrome_day', name: 'Palindrome Day', icon: '🔢', description: 'Logged on a palindrome date', category: 'secret', rarity: 'epic' },
  { id: 'lucky_7', name: 'Lucky 7', icon: '🍀', description: '7 logs on the 7th', category: 'secret', rarity: 'rare' },
  { id: 'triple_threat', name: 'Triple Threat', icon: '3️⃣', description: '3 entries in 3 hours', category: 'secret', rarity: 'uncommon' },
  { id: 'quick_draw', name: 'Quick Draw', icon: '⚡', description: 'Logged in under 5 seconds', category: 'secret', rarity: 'uncommon' },
  { id: 'novel_writer', name: 'Novel Writer', icon: '📖', description: 'Note over 500 characters', category: 'secret', rarity: 'rare' },
  { id: 'emoji_master', name: 'Emoji Master', icon: '😎', description: 'Used 10+ emojis in notes', category: 'secret', rarity: 'uncommon' },
  { id: 'full_moon', name: 'Full Moon Logger', icon: '🌕', description: 'Logged on a full moon', category: 'secret', rarity: 'rare' },
  { id: 'fibonacci', name: 'Fibonacci Fan', icon: '🌀', description: '1,1,2,3,5 logs pattern', category: 'secret', rarity: 'legendary' },
  { id: 'pi_day', name: 'Pi Day', icon: '🥧', description: 'Logged on March 14', category: 'secret', rarity: 'rare' },
  { id: 'leap_year', name: 'Leap Logger', icon: '🐸', description: 'Logged on Feb 29', category: 'secret', rarity: 'epic' },
  { id: 'solar_eclipse', name: 'Eclipse Tracker', icon: '🌑', description: 'Logged during eclipse', category: 'secret', rarity: 'legendary' },
  { id: 'early_adopter', name: 'Early Adopter', icon: '🚀', description: 'One of first 1000 users', category: 'special', rarity: 'legendary' },
  { id: 'beta_tester', name: 'Beta Tester', icon: '🧪', description: 'Helped test the app', category: 'special', rarity: 'epic' },
  { id: 'bug_hunter', name: 'Bug Hunter', icon: '🐛', description: 'Reported a bug', category: 'special', rarity: 'rare' },
  { id: 'founding_member', name: 'Founding Member', icon: '💎', description: 'Joined in first month', category: 'special', rarity: 'legendary' },
];

export const BADGE_CATEGORIES = [
  { id: 'milestone', name: 'Milestones', icon: '🎯', description: 'Entry count achievements' },
  { id: 'streak', name: 'Streaks', icon: '🔥', description: 'Consecutive day logging' },
  { id: 'consistency', name: 'Consistency', icon: '📅', description: 'Regular logging patterns' },
  { id: 'feature', name: 'Features', icon: '✨', description: 'Using app features' },
  { id: 'tracking', name: 'Tracking', icon: '📊', description: 'Symptom & trigger tracking' },
  { id: 'insight', name: 'Insights', icon: '💡', description: 'Pattern discovery' },
  { id: 'engagement', name: 'Engagement', icon: '🌟', description: 'App engagement' },
  { id: 'wellness', name: 'Wellness', icon: '💚', description: 'Health improvements' },
  { id: 'adventure', name: 'Adventure', icon: '🌍', description: 'Location-based' },
  { id: 'seasonal', name: 'Seasonal', icon: '🗓️', description: 'Special dates' },
  { id: 'secret', name: 'Secret', icon: '🔮', description: 'Hidden achievements' },
  { id: 'special', name: 'Special', icon: '💎', description: 'Exclusive badges' },
];

export const getRarityColor = (rarity: Badge['rarity']) => {
  switch (rarity) {
    case 'common': return { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-600' };
    case 'uncommon': return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600' };
    case 'rare': return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600' };
    case 'epic': return { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-600' };
    case 'legendary': return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600' };
  }
};
