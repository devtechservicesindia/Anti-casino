import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_service.dart';

final apiServiceProvider = Provider<ApiService>((ref) {
  final authService = ref.watch(authServiceProvider);
  return ApiService(authService: authService);
});

class ApiService {
  final Dio _dio;
  final AuthService _authService;

  ApiService({required AuthService authService})
      : _authService = authService,
        _dio = Dio(
          BaseOptions(
            baseUrl: 'http://10.0.2.2:4000/api/v1', // 10.0.2.2 for Android emulator -> localhost
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 10),
          ),
        ) {
    _dio.interceptors.add(_AuthInterceptor(_authService));
  }

  /// Expose the Dio client for use in repositories
  Dio get client => _dio;
}

class _AuthInterceptor extends Interceptor {
  final AuthService authService;

  _AuthInterceptor(this.authService);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await authService.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    super.onRequest(options, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Handling 401 Unauthorized globally to trigger logout
    if (err.response?.statusCode == 401) {
      await authService.logout();
    }
    super.onError(err, handler);
  }
}
