import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:math' as math;

class RouletteScreen extends StatefulWidget {
  const RouletteScreen({super.key});

  @override
  State<RouletteScreen> createState() => _RouletteScreenState();
}

class _RouletteScreenState extends State<RouletteScreen> with SingleTickerProviderStateMixin {
  late AnimationController _wheelController;
  int _selectedChip = 10;
  bool _isSpinning = false;
  int? _winningNumber;

  @override
  void initState() {
    super.initState();
    _wheelController = AnimationController(vsync: this, duration: const Duration(seconds: 4));
  }

  void _spin() {
    if (_isSpinning) return;
    setState(() {
      _isSpinning = true;
      _winningNumber = null;
    });

    _wheelController.forward(from: 0).then((_) {
      if (mounted) {
        setState(() {
          _isSpinning = false;
          _winningNumber = 17; // Mock result
        });
      }
    });
  }

  @override
  void dispose() {
    _wheelController.dispose();
    super.dispose();
  }

  Widget _buildChip(int value) {
    final isSelected = value == _selectedChip;
    return GestureDetector(
      onTap: () => setState(() => _selectedChip = value),
      child: Container(
        width: 50,
        height: 50,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isSelected ? Theme.of(context).primaryColor : Colors.grey[800],
          border: Border.all(color: Colors.white, width: isSelected ? 3 : 1),
        ),
        child: Center(
          child: Text('$value', style: TextStyle(color: isSelected ? Colors.black : Colors.white, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.go('/lobby')), title: const Text('European Roulette')),
      body: Column(
        children: [
          // Roulette Wheel Area
          Expanded(
            flex: 3,
            child: Center(
              child: AnimatedBuilder(
                animation: _wheelController,
                builder: (context, child) {
                  return Transform.rotate(
                    // Fast spins decelerating into landing
                    angle: Curves.easeOutCubic.transform(_wheelController.value) * 10 * math.pi,
                    child: Container(
                      width: 250,
                      height: 250,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Theme.of(context).primaryColor, width: 8),
                        gradient: const SweepGradient(
                          colors: [Colors.red, Colors.black, Colors.red, Colors.black, Colors.green, Colors.black],
                        ),
                      ),
                      child: Center(
                        child: Container(
                          width: 150, height: 150,
                          decoration: const BoxDecoration(color: Color(0xFF1E1033), shape: BoxShape.circle),
                          child: Center(
                            child: _winningNumber != null 
                              ? Text('$_winningNumber', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold))
                              : const Icon(Icons.casino, size: 64, color: Colors.white24),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          
          // Betting Controls
          Expanded(
            flex: 2,
            child: Container(
              color: const Color(0xFF1E1033),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                   SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [10, 50, 100, 500, 1000].map(_buildChip).toList(),
                    ),
                  ),
                  const Spacer(),
                  // Placeholder for actual grid, representing the "Place Bets" layer
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
                    child: const Text('Tap table grid to place chips (UI Placeholder)', textAlign: TextAlign.center, style: TextStyle(color: Colors.white54)),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: _isSpinning ? null : _spin,
                      child: Text(_isSpinning ? 'SPINNING...' : 'SPIN WHEEL', style: const TextStyle(fontSize: 18)),
                    ),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
