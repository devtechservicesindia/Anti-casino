import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

class CoinStoreScreen extends StatefulWidget {
  const CoinStoreScreen({super.key});

  @override
  State<CoinStoreScreen> createState() => _CoinStoreScreenState();
}

class _CoinStoreScreenState extends State<CoinStoreScreen> {
  late Razorpay _razorpay;

  final List<Map<String, dynamic>> _packages = [
    {'tokens': 1000, 'price': 100, 'bonus': 0},
    {'tokens': 5000, 'price': 450, 'bonus': 500},
    {'tokens': 10000, 'price': 850, 'bonus': 1500},
    {'tokens': 50000, 'price': 4000, 'bonus': 10000, 'popular': true},
  ];

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment Successful! Tokens Added.')));
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment Failed: ${response.message}')));
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Selected Wallet: ${response.walletName}')));
  }

  void openCheckout(int amount) {
    var options = {
      'key': 'rzp_test_placeholder', // Replaced via env in real app
      'amount': amount * 100,
      'name': 'RoyalBet Casino',
      'description': 'Token Purchase',
      'prefill': {'contact': '9876543210', 'email': 'player@royalbet.com'}
    };
    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint(e.toString());
    }
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/lobby')),
        title: const Text('Token Store'),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _packages.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 0.75,
        ),
        itemBuilder: (context, index) {
          final pkg = _packages[index];
          final isPopular = pkg['popular'] == true;

          return Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isPopular ? Theme.of(context).primaryColor : Colors.transparent,
                width: 2,
              ),
            ),
            child: Stack(
              children: [
                if (isPopular)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: Theme.of(context).primaryColor,
                        borderRadius: const BorderRadius.only(
                          bottomLeft: Radius.circular(12),
                          topRight: Radius.circular(18),
                        ),
                      ),
                      child: const Text('POPULAR', style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.diamond, size: 48, color: Theme.of(context).primaryColor),
                      const SizedBox(height: 12),
                      Text('${pkg['tokens']}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                      const Text('Tokens', style: TextStyle(color: Colors.white54)),
                      if (pkg['bonus'] > 0) ...[
                        const SizedBox(height: 8),
                        Text('+${pkg['bonus']} BONUS', style: const TextStyle(color: Colors.greenAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                      const Spacer(),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => openCheckout(pkg['price'] as int),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isPopular ? Theme.of(context).primaryColor : Colors.white12,
                            foregroundColor: isPopular ? Colors.black : Colors.white,
                          ),
                          child: Text('₹${pkg['price']}'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
