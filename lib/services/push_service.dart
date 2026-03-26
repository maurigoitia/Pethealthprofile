import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class PushService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  static String? _currentToken;
  static String? get fcmToken => _currentToken;

  static Future<void> init() async {
    await _messaging.requestPermission(
        alert: true, badge: true, sound: true);
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _local.initialize(const InitializationSettings(
        android: androidSettings, iOS: iosSettings));
    _currentToken = await _messaging.getToken();
    _messaging.onTokenRefresh.listen((t) => _currentToken = t);
    FirebaseMessaging.onMessage.listen(_showForeground);
  }

  static Future<void> _showForeground(RemoteMessage msg) async {
    final n = msg.notification;
    if (n == null) return;
    await _local.show(
        msg.hashCode,
        n.title ?? 'Pessy',
        n.body ?? '',
        const NotificationDetails(
          android: AndroidNotificationDetails(
              'pessy_default', 'Notificaciones Pessy',
              importance: Importance.high,
              priority: Priority.high,
              icon: '@mipmap/ic_launcher'),
          iOS: DarwinNotificationDetails(),
        ));
  }
}
