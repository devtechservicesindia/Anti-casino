import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _mockLeaders = List.generate(10, (i) => {
    'rank': i + 1,
    'name': 'Player_${1000 + i * 7}',
    'winnings': 50000 - (i * 3500),
  });

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/lobby')),
        title: const Text('Top Winners'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Theme.of(context).primaryColor,
          labelColor: Theme.of(context).primaryColor,
          unselectedLabelColor: Colors.white54,
          tabs: const [
            Tab(text: 'DAILY'),
            Tab(text: 'ALL TIME'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildList(),
          _buildList(),
        ],
      ),
    );
  }

  Widget _buildList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 16),
      itemCount: _mockLeaders.length,
      itemBuilder: (context, index) {
        final leader = _mockLeaders[index];
        final isTop3 = index < 3;
        final color = isTop3 ? Theme.of(context).primaryColor : Colors.white;

        return ListTile(
          leading: CircleAvatar(
            backgroundColor: isTop3 ? color.withOpacity(0.2) : Theme.of(context).colorScheme.surface,
            child: Text(
              '#${leader['rank']}',
              style: TextStyle(color: color, fontWeight: FontWeight.bold),
            ),
          ),
          title: Text(leader['name'], style: TextStyle(fontWeight: isTop3 ? FontWeight.bold : FontWeight.normal)),
          trailing: Text(
            '${leader['winnings']} 🪙',
            style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 16),
          ),
        );
      },
    );
  }
}
