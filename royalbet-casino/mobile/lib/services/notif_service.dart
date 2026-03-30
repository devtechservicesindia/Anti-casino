import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final notifServiceProvider = Provider<NotifService>((ref) {
  return NotifService();
});

class NotifService {
  final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@pragma("transparent")'); // Needs custom drawable icon later

    const DarwinInitializationSettings initializationSettingsDarwin =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsDarwin,
    );

    await _flutterLocalNotificationsPlugin.initialize(initializationSettings);
  }

  Future<void> scheduleDailyBonusReminder() async {
    // Advanced scheduling requires timezone init, for now simple immediate test
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
            'royalbet_daily_bonus', 'Daily Bonuses',
            channelDescription: 'Reminders to claim daily free tokens',
            importance: Importance.max,
            priority: Priority.high,
            showWhen: false);
            
    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);

    // Testing immediate notification (actual scheduling requires timezone package)
    // await _flutterLocalNotificationsPlugin.show(
    //     0,
    //     'Free Tokens Waiting!',
    //     'Come back and claim your daily RoyalBet tokens.',
    //     platformChannelSpecifics,
    //     payload: 'daily_bonus');
  }
}
