import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:go_router/go_router.dart';

class CrashScreen extends StatefulWidget {
  const CrashScreen({super.key});

  @override
  State<CrashScreen> createState() => _CrashScreenState();
}

class _CrashScreenState extends State<CrashScreen> with SingleTickerProviderStateMixin {
  List<FlSpot> _spots = [const FlSpot(0, 1.0)];
  double _currentMultiplier = 1.0;
  bool _isPlaying = false;
  String _gameState = 'BETTING'; // BETTING, IN_PROGRESS, CRASHED

  void _demoCrashTick() async {
    setState(() {
      _gameState = 'IN_PROGRESS';
      _isPlaying = true;
      _spots = [const FlSpot(0, 1.0)];
      _currentMultiplier = 1.0;
    });

    double time = 0;
    while (_gameState == 'IN_PROGRESS') {
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      
      time += 0.1;
      // Exponential curve: e^(rt)
      final newValue = 1 * (1 + (time * time * 0.1));
      
      setState(() {
        _currentMultiplier = double.parse(newValue.toStringAsFixed(2));
        _spots.add(FlSpot(time, _currentMultiplier));
      });

      if (_currentMultiplier >= 3.42) { // Determine crash point
        setState(() {
          _gameState = 'CRASHED';
          _isPlaying = false;
        });
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/lobby')),
        title: const Text('Crash Game'),
      ),
      body: Column(
        children: [
          // The Graph Canvas
          Expanded(
            flex: 2,
            child: Container(
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _gameState == 'CRASHED' ? Colors.red : Colors.white24, width: 2),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  LineChart(
                    LineChartData(
                      minX: 0,
                      minY: 1,
                      maxX: _spots.last.x == 0 ? 5 : _spots.last.x + 1,
                      maxY: _spots.last.y < 2 ? 2 : _spots.last.y + 0.5,
                      gridData: const FlGridData(show: false),
                      titlesData: const FlTitlesData(show: false),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [
                        LineChartBarData(
                          spots: _spots,
                          isCurved: true,
                          color: _gameState == 'CRASHED' ? Colors.red : Theme.of(context).primaryColor,
                          barWidth: 4,
                          isStrokeCapRound: true,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color: (_gameState == 'CRASHED' ? Colors.red : Theme.of(context).primaryColor).withOpacity(0.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Huge Multiplier Text Layer Over Graph
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${_currentMultiplier.toStringAsFixed(2)}x',
                        style: TextStyle(
                          fontSize: 64,
                          fontWeight: FontWeight.black,
                          color: _gameState == 'CRASHED' ? Colors.red : Colors.white,
                        ),
                      ),
                      if (_gameState == 'CRASHED')
                        const Text('CRASHED', style: TextStyle(color: Colors.red, fontSize: 24, fontWeight: FontWeight.bold)),
                    ],
                  )
                ],
              ),
            ),
          ),

          // User Action controls
          Expanded(
            flex: 1,
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Color(0xFF1E1033),
                borderRadius: BorderRadius.only(topLeft: Radius.circular(30), topRight: Radius.circular(30)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_gameState == 'BETTING' || _gameState == 'CRASHED')
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Theme.of(context).primaryColor),
                      onPressed: _demoCrashTick,
                      child: const Text('PLACE BET', style: TextStyle(fontSize: 18)),
                    )
                  else
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.greenAccent),
                      onPressed: () {
                        // Demo cashout
                        setState(() => _gameState = 'BETTING');
                      },
                      child: Text('CASHOUT AT ${_currentMultiplier.toStringAsFixed(2)}x', style: const TextStyle(fontSize: 18, color: Colors.black)),
                    ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
