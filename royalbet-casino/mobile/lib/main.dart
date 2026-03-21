import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

// Router (scaffold – uncomment once go_router config is written)
// import 'package:royalbet_casino/services/router.service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // TODO: initialise Hive, SecureStorage, Dio, etc.
  runApp(
    const ProviderScope(
      child: RoyalBetApp(),
    ),
  );
}

class RoyalBetApp extends StatelessWidget {
  const RoyalBetApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RoyalBet Casino',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFFF59E0B),    // Gold
          secondary: const Color(0xFFD97706),
          surface: const Color(0xFF1A1A2E),
          background: const Color(0xFF0A0A0F),
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0A0F),
      ),
      // router: appRouter, // TODO: wire go_router
      home: const Scaffold(
        body: Center(
          child: Text(
            '🎰 RoyalBet Casino',
            style: TextStyle(
              color: Color(0xFFF59E0B),
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}
