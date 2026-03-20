/**
 * iOS Quick Actions (Home Screen Long-Press Menu)
 * 
 * These should be set DYNAMICALLY at runtime based on the user's condition.
 * Static Info.plist shortcuts are generic; dynamic ones are condition-specific.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * NATIVE SETUP — AppDelegate.swift
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1. Add this method to set dynamic shortcuts after login.
 *    Call it from the web layer via a Capacitor plugin message:
 * 
 * // In AppDelegate.swift or a Capacitor plugin:
 * func setQuickActions(condition: String) {
 *     let conditionLabel = condition.isEmpty ? "Flare" : condition
 *     
 *     UIApplication.shared.shortcutItems = [
 *         UIApplicationShortcutItem(
 *             type: "app.jvala.health.quick-log",
 *             localizedTitle: "Log \(conditionLabel)",
 *             localizedSubtitle: "Quick one-tap log",
 *             icon: UIApplicationShortcutIcon(systemImageName: "bolt.fill"),
 *             userInfo: ["url": "jvala://quick-log?severity=moderate" as NSSecureCoding]
 *         ),
 *         UIApplicationShortcutItem(
 *             type: "app.jvala.health.voice-log",
 *             localizedTitle: "Voice Log",
 *             localizedSubtitle: "Describe how you feel",
 *             icon: UIApplicationShortcutIcon(systemImageName: "mic.fill"),
 *             userInfo: ["url": "jvala://voice-log" as NSSecureCoding]
 *         ),
 *         UIApplicationShortcutItem(
 *             type: "app.jvala.health.follow-up",
 *             localizedTitle: "Follow Up",
 *             localizedSubtitle: "Update your last entry",
 *             icon: UIApplicationShortcutIcon(systemImageName: "arrow.uturn.left.circle.fill"),
 *             userInfo: ["url": "jvala://quick-log?severity=moderate&note=follow-up" as NSSecureCoding]
 *         ),
 *     ]
 * }
 * 
 * 2. Handle the shortcut tap in AppDelegate:
 * 
 * func application(_ application: UIApplication,
 *                  performActionFor shortcutItem: UIApplicationShortcutItem,
 *                  completionHandler: @escaping (Bool) -> Void) {
 *     if let userInfo = shortcutItem.userInfo,
 *        let urlString = userInfo["url"] as? String,
 *        let url = URL(string: urlString) {
 *         NotificationCenter.default.post(
 *             name: Notification.Name.capacitorOpenURL,
 *             object: nil,
 *             userInfo: ["url": url]
 *         )
 *     }
 *     completionHandler(true)
 * }
 * 
 * 3. FALLBACK static shortcuts (Info.plist) — used before login:
 * 
 * <key>UIApplicationShortcutItems</key>
 * <array>
 *   <dict>
 *     <key>UIApplicationShortcutItemType</key>
 *     <string>app.jvala.health.quick-log</string>
 *     <key>UIApplicationShortcutItemTitle</key>
 *     <string>Quick Log</string>
 *     <key>UIApplicationShortcutItemSubtitle</key>
 *     <string>Log how you're feeling</string>
 *     <key>UIApplicationShortcutItemIconType</key>
 *     <string>UIApplicationShortcutIconTypeAdd</string>
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
 *   <dict>
 *     <key>UIApplicationShortcutItemType</key>
 *     <string>app.jvala.health.follow-up</string>
 *     <key>UIApplicationShortcutItemTitle</key>
 *     <string>Follow Up</string>
 *     <key>UIApplicationShortcutItemSubtitle</key>
 *     <string>Update last entry</string>
 *     <key>UIApplicationShortcutItemIconType</key>
 *     <string>UIApplicationShortcutIconTypeUpdate</string>
 *   </dict>
 * </array>
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Types for the web layer to communicate with the native Quick Actions
export interface QuickActionConfig {
  type: string;
  title: string;
  subtitle: string;
  urlScheme: string;
  iconName: string;
}

/**
 * Generate condition-specific Quick Action configs.
 * Called after user logs in and we know their condition.
 */
export function getQuickActionsForCondition(condition: string): QuickActionConfig[] {
  const label = condition || 'Flare';
  
  return [
    {
      type: 'app.jvala.health.quick-log',
      title: `Log ${label}`,
      subtitle: 'Quick one-tap log',
      urlScheme: 'jvala://quick-log?severity=moderate',
      iconName: 'bolt.fill',
    },
    {
      type: 'app.jvala.health.voice-log',
      title: 'Voice Log',
      subtitle: 'Describe how you feel',
      urlScheme: 'jvala://voice-log',
      iconName: 'mic.fill',
    },
    {
      type: 'app.jvala.health.follow-up',
      title: 'Follow Up',
      subtitle: 'Update your last entry',
      urlScheme: 'jvala://quick-log?severity=moderate&note=follow-up',
      iconName: 'arrow.uturn.left.circle.fill',
    },
  ];
}
