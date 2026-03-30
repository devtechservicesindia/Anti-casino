import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class BlackjackScreen extends StatefulWidget {
  const BlackjackScreen({super.key});

  @override
  State<BlackjackScreen> createState() => _BlackjackScreenState();
}

class _BlackjackScreenState extends State<BlackjackScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.go('/lobby')), title: const Text('VIP Blackjack')),
      body: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF073B24), // Classic casino felt green
        ),
        child: Column(
          children: [
            const Spacer(),
            // Dealer Area
            const Text('DEALER', style: TextStyle(color: Colors.white54, fontWeight: FontWeight.bold, letterSpacing: 2)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildCard('10', '♠'),
                const SizedBox(width: -20),
                _buildCard('?', '', isHidden: true),
              ],
            ),
            const Spacer(),
            
            // Player Area
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildCard('A', '♥', isRed: true),
                const SizedBox(width: -20),
                _buildCard('K', '♣'),
              ],
            ),
            const SizedBox(height: 16),
            const Text('PLAYER  •  21', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
            const Spacer(),

            // Controls
            Container(
              padding: const EdgeInsets.all(24),
              color: Colors.black54,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildActionButton('HIT', Colors.blue, () {}),
                  _buildActionButton('STAND', Colors.red, () {}),
                  _buildActionButton('DOUBLE', Colors.orange, () {}),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(String label, Color color, VoidCallback onTap) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))
      ),
      onPressed: onTap,
      child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildCard(String rank, String suit, {bool isRed = false, bool isHidden = false}) {
    if (isHidden) {
      return Container(
        width: 70, height: 100,
        decoration: BoxDecoration(
          color: Colors.red[900],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.white24, width: 2),
        ),
        child: const Center(child: Icon(Icons.diamond, color: Colors.white12, size: 40)),
      );
    }
    return Container(
      width: 70, height: 100,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(2, 2))],
      ),
      padding: const EdgeInsets.all(4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rank, style: TextStyle(color: isRed ? Colors.red : Colors.black, fontWeight: FontWeight.bold, fontSize: 18, height: 1)),
          Text(suit, style: TextStyle(color: isRed ? Colors.red : Colors.black, fontSize: 14)),
        ],
      ),
    );
  }
}
