import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'auth_service.dart';

final socketServiceProvider = Provider<SocketService>((ref) {
  final authService = ref.watch(authServiceProvider);
  return SocketService(authService);
});

class SocketService {
  io.Socket? socket;
  final AuthService _authService;

  SocketService(this._authService);

  Future<void> initSocket() async {
    if (socket != null && socket!.connected) return;

    final token = await _authService.getAccessToken();
    
    socket = io.io('http://10.0.2.2:4000', io.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .setAuth({'token': token})
        .build()
    );

    socket?.onConnect((_) {
      print('[Socket] Connected');
    });

    socket?.onDisconnect((_) {
      print('[Socket] Disconnected');
    });

    socket?.onError((err) {
      print('[Socket] Error: $err');
    });

    socket?.connect();
  }

  void dispose() {
    socket?.disconnect();
    socket?.dispose();
    socket = null;
  }
}
