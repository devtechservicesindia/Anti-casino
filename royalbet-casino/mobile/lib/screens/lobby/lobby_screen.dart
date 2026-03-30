import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/auth_service.dart';

class LobbyScreen extends ConsumerStatefulWidget {
  const LobbyScreen({super.key});

  @override
  ConsumerState<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends ConsumerState<LobbyScreen> {
  int _bottomNavIndex = 0;

  final List<Map<String, dynamic>> _games = [
    {'name': 'Crash', 'route': '/game/crash', 'color': Colors.redAccent, 'icon': Icons.trending_up},
    {'name': 'Slots', 'route': '/game/slots', 'color': Colors.purpleAccent, 'icon': Icons.casino},
    {'name': 'Roulette', 'route': '/game/roulette', 'color': Colors.green, 'icon': Icons.pie_chart},
    {'name': 'Blackjack', 'route': '/game/blackjack', 'color': Colors.blueAccent, 'icon': Icons.style},
    {'name': 'Poker', 'route': '/game/poker', 'color': Colors.orangeAccent, 'icon': Icons.diversity_3},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('RoyalBet Lobby', style: TextStyle(fontFamily: 'Playfair Display', fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Theme.of(context).primaryColor),
                ),
                child: Row(
                  children: [
                    Icon(Icons.stars, color: Theme.of(context).primaryColor, size: 16),
                    const SizedBox(width: 6),
                    const Text('5,000', style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          )
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _bottomNavIndex,
        backgroundColor: Theme.of(context).colorScheme.surface,
        selectedItemColor: Theme.of(context).primaryColor,
        unselectedItemColor: Colors.white54,
        type: BottomNavigationBarType.fixed,
        onTap: (idx) {
          setState(() => _bottomNavIndex = idx);
          if (idx == 1) context.push('/leaderboard');
          if (idx == 2) context.push('/store');
          if (idx == 3) context.push('/profile');
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Lobby'),
          BottomNavigationBarItem(icon: Icon(Icons.leaderboard), label: 'Leaders'),
          BottomNavigationBarItem(icon: Icon(Icons.store), label: 'Store'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  Widget _buildBody() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Scrolling Ticker Placeholder
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.campaign, color: Colors.white70, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '🏆  User123 just won 50,000 tokens in Crash!  🎉  RajaVIP hit the Slots Jackpot!  🎰',
                    style: TextStyle(fontSize: 12, color: Colors.white70),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          const Text('Top Games', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.85,
            ),
            itemCount: _games.length,
            itemBuilder: (context, index) {
              final game = _games[index];
              return GestureDetector(
                onTap: () => context.push(game['route'] as String),
                child: Container(
                  decoration: BoxDecoration(
                    color: game['color'].withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: game['color'].withOpacity(0.5), width: 1.5),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(game['icon'] as IconData, size: 54, color: game['color']),
                      const SizedBox(height: 16),
                      Text(
                        game['name'] as String,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
