import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/auth_service.dart';
import '../../services/api_service.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailPhoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _isLoading = false;

  Future<void> _handleLogin() async {
    if (_emailPhoneCtrl.text.isEmpty || _passwordCtrl.text.isEmpty) return;
    setState(() => _isLoading = true);
    try {
      final api = ref.read(apiServiceProvider).client;
      final authService = ref.read(authServiceProvider);

      final response = await api.post('/auth/login', data: {
        'emailOrPhone': _emailPhoneCtrl.text.trim(),
        'password': _passwordCtrl.text,
      });

      final token = response.data['accessToken'];
      final user = response.data['user'];

      await authService.saveSession(token, user);
      if (mounted) context.go('/lobby');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invalid credentials')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleLogin() async {
    setState(() => _isLoading = true);
    final authService = ref.read(authServiceProvider);
    
    try {
      final googleToken = await authService.getGoogleToken();
      if (googleToken == null) {
        throw Exception('Google sign-in cancelled or failed');
      }

      final api = ref.read(apiServiceProvider).client;
      final response = await api.post('/auth/google', data: {
        'googleToken': googleToken,
      });

      final token = response.data['accessToken'];
      final user = response.data['user'];

      await authService.saveSession(token, user);
      if (mounted) context.go('/lobby');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Google Login Failed')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailPhoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              Center(
                child: Icon(Icons.diamond_outlined, size: 60, color: Theme.of(context).primaryColor),
              ),
              const SizedBox(height: 24),
              const Text(
                'Welcome Back',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Sign in to continue your winning streak',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 48),
              TextField(
                controller: _emailPhoneCtrl,
                decoration: const InputDecoration(
                  hintText: 'Email or Phone Number',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  hintText: 'Password',
                  prefixIcon: Icon(Icons.lock_outline),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                height: 54,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading 
                    ? const CircularProgressIndicator(color: Colors.black)
                    : const Text('SIGN IN'),
                ),
              ),
              const SizedBox(height: 24),
              const Center(child: Text('OR', style: TextStyle(color: Colors.white54))),
              const SizedBox(height: 24),
              SizedBox(
                height: 54,
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : _handleGoogleLogin,
                  icon: const Icon(Icons.g_mobiledata, size: 28, color: Colors.white),
                  label: const Text('Continue with Google', style: TextStyle(color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white24, width: 2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text("Don't have an account?", style: TextStyle(color: Colors.white70)),
                  TextButton(
                    onPressed: () => context.push('/register'),
                    child: Text('Register Now', style: TextStyle(color: Theme.of(context).primaryColor)),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}
