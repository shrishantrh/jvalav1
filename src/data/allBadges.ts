// Comprehensive badge system with earning instructions
export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  howToGet: string;
  category: 'milestone' | 'streak' | 'consistency' | 'feature' | 'tracking' | 'insight' | 'engagement' | 'special' | 'adventure' | 'wellness' | 'social' | 'seasonal' | 'secret';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export const ALL_BADGES: Badge[] = [
  // === MILESTONE BADGES ===
  { id: 'first_log', name: 'First Log', icon: '🌟', description: 'Logged your first entry', howToGet: 'Log your very first flare or note entry.', category: 'milestone', rarity: 'common' },
  { id: 'logs_10', name: 'Getting Started', icon: '📝', description: '10 total entries', howToGet: 'Log 10 total entries. Keep tracking daily!', category: 'milestone', rarity: 'common' },
  { id: 'logs_25', name: 'Quarter Century', icon: '📊', description: '25 total entries', howToGet: 'Reach 25 total log entries.', category: 'milestone', rarity: 'common' },
  { id: 'logs_50', name: 'Halfway There', icon: '⭐', description: '50 total entries', howToGet: 'Log 50 entries — you\'re building a real health picture.', category: 'milestone', rarity: 'uncommon' },
  { id: 'logs_100', name: 'Century Club', icon: '💯', description: '100 total entries', howToGet: 'Reach 100 total entries. Your data is getting powerful!', category: 'milestone', rarity: 'uncommon' },
  { id: 'logs_250', name: 'Dedicated Logger', icon: '🏅', description: '250 total entries', howToGet: 'Log 250 entries. You\'re truly dedicated.', category: 'milestone', rarity: 'rare' },
  { id: 'logs_500', name: 'Half Thousand', icon: '🎖️', description: '500 total entries', howToGet: 'Reach 500 total entries.', category: 'milestone', rarity: 'rare' },
  { id: 'logs_1000', name: 'Millennium Master', icon: '👑', description: '1000 total entries', howToGet: 'Log 1000 entries. Absolute legend status.', category: 'milestone', rarity: 'epic' },
  { id: 'logs_2500', name: 'Legend', icon: '🏆', description: '2500 total entries', howToGet: 'Reach 2500 entries. You are the 1%.', category: 'milestone', rarity: 'legendary' },

  // === STREAK BADGES ===
  { id: 'streak_3', name: '3-Day Streak', icon: '🔥', description: '3 days in a row', howToGet: 'Log at least once for 3 consecutive days.', category: 'streak', rarity: 'common' },
  { id: 'streak_7', name: 'Week Warrior', icon: '💪', description: '7 days in a row', howToGet: 'Log every day for a full week.', category: 'streak', rarity: 'common' },
  { id: 'streak_14', name: 'Fortnight Fighter', icon: '⚡', description: '14 days in a row', howToGet: 'Maintain a 14-day logging streak.', category: 'streak', rarity: 'uncommon' },
  { id: 'streak_21', name: 'Habit Builder', icon: '🧱', description: '21 days - habit formed!', howToGet: '21 days of consecutive logging. Science says it\'s now a habit!', category: 'streak', rarity: 'uncommon' },
  { id: 'streak_30', name: 'Monthly Master', icon: '📅', description: '30 days in a row', howToGet: 'Log every single day for a month.', category: 'streak', rarity: 'rare' },
  { id: 'streak_60', name: 'Iron Will', icon: '🦾', description: '60 days straight', howToGet: 'Maintain a 60-day streak. Incredible discipline.', category: 'streak', rarity: 'rare' },
  { id: 'streak_90', name: 'Quarterly Champion', icon: '🏋️', description: '90 days - quarter year!', howToGet: 'Log every day for 3 months straight.', category: 'streak', rarity: 'epic' },
  { id: 'streak_180', name: 'Half Year Hero', icon: '🌙', description: '180 days streak', howToGet: '6 months of daily logging. Unreal commitment.', category: 'streak', rarity: 'epic' },
  { id: 'streak_365', name: 'Year of Dedication', icon: '🎊', description: 'Full year streak!', howToGet: 'Log every single day for an entire year.', category: 'streak', rarity: 'legendary' },
  { id: 'streak_comeback', name: 'Comeback Kid', icon: '🔄', description: 'Rebuilt streak after breaking', howToGet: 'Reach a 7+ day streak after your previous streak was broken.', category: 'streak', rarity: 'uncommon' },

  // === CONSISTENCY BADGES ===
  { id: 'perfect_week', name: 'Perfect Week', icon: '✨', description: 'Logged every day for a week', howToGet: 'Log at least one entry every day for 7 consecutive days.', category: 'consistency', rarity: 'uncommon' },
  { id: 'consistency_king', name: 'Consistency King', icon: '👑', description: '80%+ logging for a month', howToGet: 'Log on at least 80% of days in a calendar month (min 7 days).', category: 'consistency', rarity: 'rare' },
  { id: 'never_miss_monday', name: 'Never Miss Monday', icon: '🌅', description: 'Logged every Monday for a month', howToGet: 'Log on every Monday for 4 consecutive weeks.', category: 'consistency', rarity: 'uncommon' },
  { id: 'weekend_warrior', name: 'Weekend Warrior', icon: '🎉', description: 'Logged every weekend for a month', howToGet: 'Log on every Saturday and Sunday for 4 consecutive weeks.', category: 'consistency', rarity: 'uncommon' },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', description: '10 logs before 7 AM', howToGet: 'Log 10 entries before 7 AM local time.', category: 'consistency', rarity: 'uncommon' },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', description: '10 logs after 10 PM', howToGet: 'Log 10 entries after 10 PM local time.', category: 'consistency', rarity: 'uncommon' },
  { id: 'lunch_logger', name: 'Lunch Logger', icon: '🍱', description: '10 logs at noon', howToGet: 'Log 10 entries between 11 AM and 1 PM.', category: 'consistency', rarity: 'common' },
  { id: 'routine_master', name: 'Routine Master', icon: '⏰', description: 'Logged at same time 14 days', howToGet: 'Log at roughly the same hour for 14 days.', category: 'consistency', rarity: 'rare' },

  // === FEATURE BADGES ===
  { id: 'detailed_first', name: 'Detail Oriented', icon: '🔍', description: 'First detailed entry', howToGet: 'Add symptoms, triggers, or notes to any log entry.', category: 'feature', rarity: 'common' },
  { id: 'photo_first', name: 'Picture Perfect', icon: '📸', description: 'First photo log', howToGet: 'Attach a photo to any log entry.', category: 'feature', rarity: 'common' },
  { id: 'photo_10', name: 'Photographer', icon: '📷', description: '10 photo logs', howToGet: 'Attach photos to 10 different entries.', category: 'feature', rarity: 'uncommon' },
  { id: 'voice_first', name: 'Voice Logger', icon: '🎤', description: 'First voice note', howToGet: 'Record a voice note in any log entry.', category: 'feature', rarity: 'common' },
  { id: 'voice_10', name: 'Podcaster', icon: '🎙️', description: '10 voice notes', howToGet: 'Record voice notes in 10 different entries.', category: 'feature', rarity: 'uncommon' },
  { id: 'export_pro', name: 'Export Pro', icon: '📤', description: 'First health export', howToGet: 'Download or email a health export from the Exports tab.', category: 'feature', rarity: 'uncommon' },
  { id: 'share_master', name: 'Share Master', icon: '🔗', description: 'Shared with physician', howToGet: 'Email a health report to your healthcare provider.', category: 'feature', rarity: 'uncommon' },
  { id: 'ai_chatter', name: 'AI Chatter', icon: '🤖', description: '50 AI conversations', howToGet: 'Send 50 messages to the AI health assistant.', category: 'feature', rarity: 'rare' },
  { id: 'wearable_connected', name: 'Connected Life', icon: '⌚', description: 'Connected a wearable', howToGet: 'Connect a wearable device (Fitbit, Apple Health, etc).', category: 'feature', rarity: 'uncommon' },
  { id: 'custom_shortcut', name: 'Shortcut Master', icon: '⚡', description: 'Created custom shortcuts', howToGet: 'Add a custom trackable to your quick log panel.', category: 'feature', rarity: 'common' },

  // === TRACKING BADGES ===
  { id: 'symptom_tracker', name: 'Symptom Tracker', icon: '🩺', description: 'Tracked 10 different symptoms', howToGet: 'Log 10 unique symptoms across your entries.', category: 'tracking', rarity: 'uncommon' },
  { id: 'symptom_master', name: 'Symptom Master', icon: '🏥', description: 'Tracked 25 different symptoms', howToGet: 'Log 25 unique symptoms. You know your body well.', category: 'tracking', rarity: 'rare' },
  { id: 'trigger_detective', name: 'Trigger Detective', icon: '🔎', description: 'Logged 10 different triggers', howToGet: 'Log 10 unique triggers across your entries.', category: 'tracking', rarity: 'uncommon' },
  { id: 'trigger_master', name: 'Trigger Master', icon: '🎯', description: 'Logged 25 different triggers', howToGet: 'Identify and log 25 unique triggers.', category: 'tracking', rarity: 'rare' },
  { id: 'med_tracker', name: 'Med Tracker', icon: '💊', description: 'Logged 20 medication doses', howToGet: 'Log medications in 20 entries.', category: 'tracking', rarity: 'uncommon' },
  { id: 'med_adherent', name: 'Med Adherent', icon: '💉', description: 'Perfect med logging for a week', howToGet: 'Include medication data in your logs every day for a week.', category: 'tracking', rarity: 'rare' },
  { id: 'energy_tracker', name: 'Energy Tracker', icon: '🔋', description: '20 energy logs', howToGet: 'Log your energy level in 20 entries.', category: 'tracking', rarity: 'uncommon' },
  { id: 'mood_master', name: 'Mood Master', icon: '🎭', description: 'All mood types logged', howToGet: 'Log all severity levels: mild, moderate, and severe.', category: 'tracking', rarity: 'rare' },
  { id: 'weather_watcher', name: 'Weather Watcher', icon: '🌤️', description: '50 weather-tagged entries', howToGet: 'Have weather data auto-attached to 50 entries (needs location permission).', category: 'tracking', rarity: 'uncommon' },
  { id: 'location_tracker', name: 'Location Logger', icon: '📍', description: '10 different locations logged', howToGet: 'Log from 10 different cities/locations.', category: 'tracking', rarity: 'uncommon' },

  // === INSIGHT BADGES ===
  { id: 'pattern_detective', name: 'Pattern Detective', icon: '🔮', description: 'Discovered first correlation', howToGet: 'The app will discover correlations automatically as you log more data.', category: 'insight', rarity: 'uncommon' },
  { id: 'health_analyst', name: 'Health Analyst', icon: '📈', description: '5 correlations discovered', howToGet: 'Have 5 correlations discovered by logging consistently.', category: 'insight', rarity: 'rare' },
  { id: 'data_scientist', name: 'Data Scientist', icon: '🧪', description: '10 correlations discovered', howToGet: 'Reach 10 discovered correlations. More data = more insights.', category: 'insight', rarity: 'epic' },
  { id: 'insight_seeker', name: 'Insight Seeker', icon: '💡', description: 'Viewed insights 10 times', howToGet: 'Visit the Insights tab 10 times.', category: 'insight', rarity: 'uncommon' },
  { id: 'chart_reader', name: 'Chart Reader', icon: '📊', description: 'Viewed all chart types', howToGet: 'View all tabs in the Insights section (AI, Safety, Charts, Map).', category: 'insight', rarity: 'uncommon' },
  { id: 'prediction_pro', name: 'Prediction Pro', icon: '🔮', description: 'Received 5 predictions', howToGet: 'Get 5 predictive insights from the AI (requires 30+ entries).', category: 'insight', rarity: 'rare' },

  // === ENGAGEMENT BADGES ===
  { id: 'profile_complete', name: 'Profile Pro', icon: '✅', description: 'Completed profile 100%', howToGet: 'Fill out all profile fields in Settings > Profile.', category: 'engagement', rarity: 'common' },
  { id: 'settings_explorer', name: 'Settings Explorer', icon: '⚙️', description: 'Visited all settings', howToGet: 'Visit the Settings page.', category: 'engagement', rarity: 'common' },
  { id: 'theme_changer', name: 'Theme Changer', icon: '🎨', description: 'Changed theme color', howToGet: 'Change the app theme color in Settings.', category: 'engagement', rarity: 'common' },
  { id: 'reminder_set', name: 'Reminder Set', icon: '🔔', description: 'Set up reminders', howToGet: 'Enable daily reminders in Settings > Reminders.', category: 'engagement', rarity: 'common' },
  { id: 'feedback_giver', name: 'Feedback Giver', icon: '💬', description: 'Gave app feedback', howToGet: 'Send feedback through the app.', category: 'engagement', rarity: 'uncommon' },
  { id: 'app_veteran', name: 'App Veteran', icon: '🎖️', description: 'Using app for 30+ days', howToGet: 'Have your account for at least 30 days.', category: 'engagement', rarity: 'uncommon' },
  { id: 'power_user', name: 'Power User', icon: '⚡', description: 'Used 10+ features', howToGet: 'Use at least 10 different app features.', category: 'engagement', rarity: 'rare' },

  // === WELLNESS BADGES ===
  { id: 'flare_free_3', name: 'Clear Skies', icon: '☀️', description: '3 days flare-free', howToGet: 'Go 3 days without logging a flare (while still logging).', category: 'wellness', rarity: 'common' },
  { id: 'flare_free_7', name: 'Smooth Week', icon: '🌈', description: '7 days flare-free', howToGet: 'A full week with no flares logged.', category: 'wellness', rarity: 'uncommon' },
  { id: 'flare_free_14', name: 'Fortnight Clear', icon: '🌻', description: '14 days flare-free', howToGet: '2 weeks without any flare entries.', category: 'wellness', rarity: 'rare' },
  { id: 'flare_free_30', name: 'Monthly Miracle', icon: '🦋', description: '30 days flare-free', howToGet: 'An entire month flare-free. Amazing!', category: 'wellness', rarity: 'epic' },
  { id: 'improving_trend', name: 'Upward Bound', icon: '📈', description: 'Improving trend 2 weeks', howToGet: 'Show improving severity trends over 2 weeks.', category: 'wellness', rarity: 'uncommon' },
  { id: 'recovery_champion', name: 'Recovery Champion', icon: '🏆', description: 'Recovered from severe flare', howToGet: 'Log a mild entry within 48 hours of a severe flare.', category: 'wellness', rarity: 'rare' },
  { id: 'sleep_champion', name: 'Sleep Champion', icon: '😴', description: '7+ hours avg for a week', howToGet: 'Average 7+ hours of sleep for a week (requires wearable).', category: 'wellness', rarity: 'uncommon' },
  { id: 'hydration_hero', name: 'Hydration Hero', icon: '💧', description: 'Logged hydration 7 days', howToGet: 'Track hydration for 7 consecutive days.', category: 'wellness', rarity: 'uncommon' },

  // === ADVENTURE/LOCATION BADGES ===
  { id: 'globe_trotter', name: 'Globe Trotter', icon: '🌍', description: 'Logged in 3+ countries', howToGet: 'Log entries from 3 or more different countries.', category: 'adventure', rarity: 'rare' },
  { id: 'world_traveler', name: 'World Traveler', icon: '✈️', description: 'Logged in 5+ countries', howToGet: 'Log entries from 5 or more countries.', category: 'adventure', rarity: 'epic' },
  { id: 'road_tripper', name: 'Road Tripper', icon: '🚗', description: 'Logged in 5+ cities', howToGet: 'Log from 5 different cities.', category: 'adventure', rarity: 'uncommon' },
  { id: 'city_hopper', name: 'City Hopper', icon: '🏙️', description: 'Logged in 10+ cities', howToGet: 'Log from 10 different cities.', category: 'adventure', rarity: 'rare' },
  { id: 'nomad', name: 'Digital Nomad', icon: '🏕️', description: 'Logged from new location', howToGet: 'Log from a city you haven\'t logged from before.', category: 'adventure', rarity: 'common' },
  { id: 'beach_logger', name: 'Beach Logger', icon: '🏖️', description: 'Logged near the ocean', howToGet: 'Log from a coastal location.', category: 'adventure', rarity: 'uncommon' },
  { id: 'mountain_tracker', name: 'Mountain Tracker', icon: '⛰️', description: 'Logged at high altitude', howToGet: 'Log from a mountainous location.', category: 'adventure', rarity: 'rare' },
  { id: 'timezone_jumper', name: 'Timezone Jumper', icon: '🌐', description: 'Logged in 3+ timezones', howToGet: 'Log from 3 different timezones.', category: 'adventure', rarity: 'rare' },

  // === SEASONAL BADGES ===
  { id: 'new_year_logger', name: 'New Year Logger', icon: '🎆', description: 'Logged on New Year\'s Day', howToGet: 'Log an entry on January 1st.', category: 'seasonal', rarity: 'uncommon' },
  { id: 'valentines_care', name: 'Self-Love', icon: '💝', description: 'Logged on Valentine\'s Day', howToGet: 'Log an entry on February 14th.', category: 'seasonal', rarity: 'uncommon' },
  { id: 'spring_tracker', name: 'Spring Tracker', icon: '🌸', description: 'Active during spring', howToGet: 'Log entries during March-May.', category: 'seasonal', rarity: 'common' },
  { id: 'summer_logger', name: 'Summer Logger', icon: '🌞', description: 'Active during summer', howToGet: 'Log entries during June-August.', category: 'seasonal', rarity: 'common' },
  { id: 'fall_tracker', name: 'Fall Tracker', icon: '🍂', description: 'Active during fall', howToGet: 'Log entries during September-November.', category: 'seasonal', rarity: 'common' },
  { id: 'winter_warrior', name: 'Winter Warrior', icon: '❄️', description: 'Active during winter', howToGet: 'Log entries during December-February.', category: 'seasonal', rarity: 'common' },
  { id: 'halloween_logger', name: 'Spooky Logger', icon: '🎃', description: 'Logged on Halloween', howToGet: 'Log an entry on October 31st.', category: 'seasonal', rarity: 'uncommon' },
  { id: 'thanksgiving_gratitude', name: 'Grateful', icon: '🦃', description: 'Logged on Thanksgiving', howToGet: 'Log on the 4th Thursday of November.', category: 'seasonal', rarity: 'uncommon' },
  { id: 'holiday_health', name: 'Holiday Health', icon: '🎄', description: 'Logged on Christmas', howToGet: 'Log an entry on December 25th.', category: 'seasonal', rarity: 'uncommon' },
  { id: 'birthday_log', name: 'Birthday Logger', icon: '🎂', description: 'Logged on your birthday', howToGet: 'Log an entry on your birthday (set DOB in profile).', category: 'seasonal', rarity: 'rare' },

  // === SECRET/SPECIAL BADGES ===
  { id: 'midnight_logger', name: 'Midnight Logger', icon: '🌙', description: 'Logged at exactly midnight', howToGet: 'This is a secret badge. Keep logging and you might discover it!', category: 'secret', rarity: 'rare' },
  { id: 'palindrome_day', name: 'Palindrome Day', icon: '🔢', description: 'Logged on a palindrome date', howToGet: 'Secret: Log on a palindrome date (e.g. 12/02/2021).', category: 'secret', rarity: 'epic' },
  { id: 'lucky_7', name: 'Lucky 7', icon: '🍀', description: '7 logs on the 7th', howToGet: 'Secret: Log 7 entries on the 7th day of any month.', category: 'secret', rarity: 'rare' },
  { id: 'triple_threat', name: 'Triple Threat', icon: '3️⃣', description: '3 entries in 3 hours', howToGet: 'Secret: Log 3 entries within a 3-hour window.', category: 'secret', rarity: 'uncommon' },
  { id: 'quick_draw', name: 'Quick Draw', icon: '⚡', description: 'Logged in under 5 seconds', howToGet: 'Secret: Complete a quick log super fast.', category: 'secret', rarity: 'uncommon' },
  { id: 'novel_writer', name: 'Novel Writer', icon: '📖', description: 'Note over 500 characters', howToGet: 'Secret: Write a note with more than 500 characters.', category: 'secret', rarity: 'rare' },
  { id: 'emoji_master', name: 'Emoji Master', icon: '😎', description: 'Used 10+ emojis in notes', howToGet: 'Secret: Include 10+ emojis in a single note.', category: 'secret', rarity: 'uncommon' },
  { id: 'full_moon', name: 'Full Moon Logger', icon: '🌕', description: 'Logged on a full moon', howToGet: 'Secret: Log during a full moon.', category: 'secret', rarity: 'rare' },
  { id: 'fibonacci', name: 'Fibonacci Fan', icon: '🌀', description: '1,1,2,3,5 logs pattern', howToGet: 'Secret: An extremely rare hidden achievement.', category: 'secret', rarity: 'legendary' },
  { id: 'pi_day', name: 'Pi Day', icon: '🥧', description: 'Logged on March 14', howToGet: 'Log an entry on March 14th (Pi Day).', category: 'secret', rarity: 'rare' },
  { id: 'leap_year', name: 'Leap Logger', icon: '🐸', description: 'Logged on Feb 29', howToGet: 'Log an entry on February 29th (Leap Day).', category: 'secret', rarity: 'epic' },
  { id: 'solar_eclipse', name: 'Eclipse Tracker', icon: '🌑', description: 'Logged during eclipse', howToGet: 'Secret: An extremely rare hidden achievement.', category: 'secret', rarity: 'legendary' },
  { id: 'early_adopter', name: 'Early Adopter', icon: '🚀', description: 'One of first 1000 users', howToGet: 'Be one of the first 1000 Jvala users.', category: 'special', rarity: 'legendary' },
  { id: 'beta_tester', name: 'Beta Tester', icon: '🧪', description: 'Helped test the app', howToGet: 'Granted to beta testers who helped shape Jvala.', category: 'special', rarity: 'epic' },
  { id: 'bug_hunter', name: 'Bug Hunter', icon: '🐛', description: 'Reported a bug', howToGet: 'Report a bug through the app feedback.', category: 'special', rarity: 'rare' },
  { id: 'founding_member', name: 'Founding Member', icon: '💎', description: 'Joined in first month', howToGet: 'Joined Jvala within the first month of launch.', category: 'special', rarity: 'legendary' },
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
