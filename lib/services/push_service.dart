import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class PushService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static String? _currentToken;
  static String? get fcmToken => _currentToken;

  static Future<void> init() async {
    // Request permission (iOS shows native dialog)
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Setup local notifications (for foreground display)
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(
          android: androidSettings, iOS: iosSettings),
    );

    // Get FCM token
    final token = await _messaging.getToken();
    if (token != null) {
      _currentToken = token;
    }

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) {
      _currentToken = newToken;
    });

    // Foreground messages → show local notification
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
  }

  static Future<void> _showForegroundNotification(RemoteMessage msg) async {
    final notification = msg.notification;
    if (notification == null) return;

    await _local.show(
      msg.hashCode,
      notification.title ?? 'Pessy',
      notification.body ?? '',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'pessy_default',
          'Notificaciones Pessy',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
