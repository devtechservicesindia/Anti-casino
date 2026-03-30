import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

// Placeholder screen imports to unblock router
// Auth
import '../screens/auth/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/otp_verify_screen.dart';

// Core
import '../screens/lobby/lobby_screen.dart';
import '../screens/store/coin_store_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/leaderboard/leaderboard_screen.dart';

// Games
import '../screens/games/slots_screen.dart';
import '../screens/games/crash_screen.dart';
import '../screens/games/roulette_screen.dart';
import '../screens/games/blackjack_screen.dart';
import '../screens/games/poker_lobby_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

final GoRouter appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/verify-otp',
      builder: (context, state) => const OtpVerifyScreen(),
    ),
    GoRoute(
      path: '/lobby',
      builder: (context, state) => const LobbyScreen(),
    ),
    GoRoute(
      path: '/profile',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      path: '/store',
      builder: (context, state) => const CoinStoreScreen(),
    ),
    GoRoute(
      path: '/leaderboard',
      builder: (context, state) => const LeaderboardScreen(),
    ),
    GoRoute(
      path: '/game/slots',
      builder: (context, state) => const SlotsScreen(),
    ),
    GoRoute(
      path: '/game/crash',
      builder: (context, state) => const CrashScreen(),
    ),
    GoRoute(
      path: '/game/roulette',
      builder: (context, state) => const RouletteScreen(),
    ),
    GoRoute(
      path: '/game/blackjack',
      builder: (context, state) => const BlackjackScreen(),
    ),
    GoRoute(
      path: '/game/poker',
      builder: (context, state) => const PokerLobbyScreen(),
    ),
  ],
);
