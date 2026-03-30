import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class PokerLobbyScreen extends StatelessWidget {
  const PokerLobbyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> tables = [
      {'name': 'Beginner Stakes', 'blinds': '10/20', 'players': '4/6', 'minBuy': 400},
      {'name': 'Las Vegas Pro', 'blinds': '50/100', 'players': '6/6', 'minBuy': 2000},
      {'name': 'High Rollers VIP', 'blinds': '500/1000', 'players': '2/6', 'minBuy': 20000},
      {'name': 'Texas Quick Fold', 'blinds': '25/50', 'players': '5/6', 'minBuy': 1000},
    ];

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/lobby')),
        title: const Text('Texas Hold\'em Poker'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(40),
          child: Container(
            color: Theme.of(context).primaryColor,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: const Center(child: Text('SELECT A TABLE', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold))),
          ),
        ),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: tables.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final t = tables[index];
          final isFull = t['players'] == '6/6';
          
          return Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white12),
            ),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 50, height: 50,
                  decoration: BoxDecoration(color: Colors.green[900], shape: BoxShape.circle),
                  child: const Center(child: Icon(Icons.style, color: Colors.white70)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 4),
                      Text('Blinds: ${t['blinds']} • Min: ${t['minBuy']}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(t['players'], style: TextStyle(color: isFull ? Colors.redAccent : Colors.greenAccent, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isFull ? Colors.grey[800] : Theme.of(context).primaryColor,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                        minimumSize: const Size(0, 32),
                      ),
                      onPressed: isFull ? null : () {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connecting to table socket...')));
                      },
                      child: Text(isFull ? 'FULL' : 'JOIN', style: TextStyle(color: isFull ? Colors.white54 : Colors.black, fontSize: 12)),
                    )
                  ],
                )
              ],
            ),
          );
        },
      ),
    );
  }
}
