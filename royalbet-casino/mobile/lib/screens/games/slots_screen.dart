import 'package:flutter/material.dart';
import 'package:flame/game.dart';
import 'package:flame/components.dart';
import 'package:go_router/go_router.dart';

class SlotsScreen extends StatefulWidget {
  const SlotsScreen({super.key});

  @override
  State<SlotsScreen> createState() => _SlotsScreenState();
}

class _SlotsScreenState extends State<SlotsScreen> {
  int _betAmount = 10;
  bool _isSpinning = false;
  late final SlotsGame _game;

  @override
  void initState() {
    super.initState();
    _game = SlotsGame();
  }

  void _spin() {
    if (_isSpinning) return;
    setState(() => _isSpinning = true);
    
    // Trigger Flame game spin logic
    _game.startSpin(() {
      if (mounted) setState(() => _isSpinning = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/lobby')),
        title: const Text('Mega Slots'),
        backgroundColor: Colors.transparent,
      ),
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0D0020), Color(0xFF1E1030)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 20),
              // JACKPOT
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: Theme.of(context).primaryColor, width: 2),
                ),
                child: Column(
                  children: [
                    Text('GRAND JACKPOT', style: TextStyle(color: Theme.of(context).primaryColor, fontWeight: FontWeight.bold, letterSpacing: 2)),
                    const Text('🪙 1,450,290', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white)),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              
              // Flame Engine Container
              Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white24, width: 4),
                    boxShadow: [
                      BoxShadow(color: Theme.of(context).primaryColor.withOpacity(0.3), blurRadius: 20, spreadRadius: 5)
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: GameWidget(game: _game),
                  ),
                ),
              ),

              const SizedBox(height: 40),
              
              // Controls
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Bet Adjust
                    Column(
                      children: [
                        const Text('BET', style: TextStyle(color: Colors.white54, fontWeight: FontWeight.bold)),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, color: Colors.white),
                              onPressed: _isSpinning ? null : () => setState(() => _betAmount = (_betAmount - 10).clamp(10, 1000)),
                            ),
                            Text('$_betAmount', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline, color: Colors.white),
                              onPressed: _isSpinning ? null : () => setState(() => _betAmount = (_betAmount + 10).clamp(10, 1000)),
                            ),
                          ],
                        )
                      ],
                    ),
                    
                    // Spin Button
                    GestureDetector(
                      onTap: _isSpinning ? null : _spin,
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isSpinning ? Colors.grey[800] : Theme.of(context).primaryColor,
                          boxShadow: [
                            if (!_isSpinning)
                              BoxShadow(color: Theme.of(context).primaryColor.withOpacity(0.5), blurRadius: 20, spreadRadius: 5),
                          ],
                        ),
                        child: Center(
                          child: Text(
                            _isSpinning ? 'SPINNING' : 'SPIN',
                            style: TextStyle(
                              color: _isSpinning ? Colors.white54 : Colors.black,
                              fontSize: 20,
                              fontWeight: FontWeight.black,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}

// ── FLAME ENGINE LOGIC ──────────────────────────────────────
class SlotsGame extends FlameGame {
  bool isSpinning = false;
  Function()? onSpinComplete;
  
  late TextComponent centerText;

  @override
  Future<void> onLoad() async {
    // Placeholder initial state
    centerText = TextComponent(
      text: '🍒  🔔  🍉',
      textRenderer: TextPaint(style: const TextStyle(fontSize: 48, color: Colors.white)),
      anchor: Anchor.center,
      position: Vector2(size.x / 2, size.y / 2),
    );
    add(centerText);
  }

  void startSpin(Function() onComplete) async {
    if (isSpinning) return;
    isSpinning = true;
    onSpinComplete = onComplete;
    
    // Simulate API delay and animation
    centerText.text = '...';
    
    await Future.delayed(const Duration(seconds: 2)); // Simulate network+spin time
    
    // Result
    centerText.text = '7️⃣  7️⃣  7️⃣'; // Mock result
    
    isSpinning = false;
    onSpinComplete?.call();
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    if (children.contains(centerText)) {
      centerText.position = Vector2(size.x / 2, size.y / 2);
    }
  }
}
