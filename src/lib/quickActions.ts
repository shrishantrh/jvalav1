/**
 * iOS Quick Actions (Home Screen Long-Press Menu)
 * 
 * This module handles the native iOS Quick Actions that appear when
 * a user long-presses the Jvala app icon on the Home Screen.
 * 
 * NATIVE SETUP REQUIRED:
 * Add the following to your iOS project's Info.plist (inside the root <dict>):
 * 
 * <key>UIApplicationShortcutItems</key>
 * <array>
 *   <dict>
 *     <key>UIApplicationShortcutItemType</key>
 *     <string>app.jvala.health.quick-log-mild</string>
 *     <key>UIApplicationShortcutItemTitle</key>
 *     <string>Log Mild Flare</string>
 *     <key>UIApplicationShortcutItemSubtitle</key>
 *     <string>Quick one-tap log</string>
 *     <key>UIApplicationShortcutItemIconType</key>
 *     <string>UIApplicationShortcutIconTypeAdd</string>
 *   </dict>
 *   <dict>
 *     <key>UIApplicationShortcutItemType</key>
 *     <string>app.jvala.health.quick-log-moderate</string>
 *     <key>UIApplicationShortcutItemTitle</key>
 *     <string>Log Moderate Flare</string>
 *     <key>UIApplicationShortcutItemSubtitle</key>
 *     <string>Quick one-tap log</string>
 *     <key>UIApplicationShortcutItemIconType</key>
 *     <string>UIApplicationShortcutIconTypeAlarm</string>
 *   </dict>
 *   <dict>
 *     <key>UIApplicationShortcutItemType</key>
 *     <string>app.jvala.health.quick-log-severe</string>
 *     <key>UIApplicationShortcutItemTitle</key>
 *     <string>Log Severe Flare</string>
 *     <key>UIApplicationShortcutItemSubtitle</key>
 *     <string>Quick one-tap log</string>
 *     <key>UIApplicationShortcutItemIconType</key>
 *     <string>UIApplicationShortcutIconTypeCapturePhoto</string>
 *   </dict>
 *   <dict>
 *     <key>UIApplicationShortcutItemType</key>
 *     <string>app.jvala.health.voice-log</string>
 *     <key>UIApplicationShortcutItemTitle</key>
 *     <string>Voice Log</string>
 *     <key>UIApplicationShortcutItemSubtitle</key>
 *     <string>Describe how you feel</string>
 *     <key>UIApplicationShortcutItemIconType</key>
 *     <string>UIApplicationShortcutIconTypeAudio</string>
 *   </dict>
 * </array>
 * 
 * Also add this to AppDelegate.swift:
 * 
 * func application(_ application: UIApplication,
 *                  performActionFor shortcutItem: UIApplicationShortcutItem,
 *                  completionHandler: @escaping (Bool) -> Void) {
 *     let typeMap: [String: String] = [
 *         "app.jvala.health.quick-log-mild": "jvala://quick-log?severity=mild",
 *         "app.jvala.health.quick-log-moderate": "jvala://quick-log?severity=moderate",
 *         "app.jvala.health.quick-log-severe": "jvala://quick-log?severity=severe",
 *         "app.jvala.health.voice-log": "jvala://voice-log",
 *     ]
 *     if let urlString = typeMap[shortcutItem.type],
 *        let url = URL(string: urlString) {
 *         NotificationCenter.default.post(
 *             name: .capacitorOpenURL,
 *             object: nil,
 *             userInfo: ["url": url]
 *         )
 *     }
 *     completionHandler(true)
 * }
 */

export const QUICK_ACTION_TYPES = {
  MILD: 'app.jvala.health.quick-log-mild',
  MODERATE: 'app.jvala.health.quick-log-moderate', 
  SEVERE: 'app.jvala.health.quick-log-severe',
  VOICE: 'app.jvala.health.voice-log',
} as const;

export const QUICK_ACTION_URL_MAP: Record<string, string> = {
  [QUICK_ACTION_TYPES.MILD]: 'jvala://quick-log?severity=mild',
  [QUICK_ACTION_TYPES.MODERATE]: 'jvala://quick-log?severity=moderate',
  [QUICK_ACTION_TYPES.SEVERE]: 'jvala://quick-log?severity=severe',
  [QUICK_ACTION_TYPES.VOICE]: 'jvala://voice-log',
};
