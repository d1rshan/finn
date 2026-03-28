import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const Color cardColor = Color(0xFF161616);
  static const Color accentGreen = Color(0xFFD4FF26);
  static const Color textGrey = Color(0xFF8A8A8E);
  static const Color expenseRed = Color(0xFFFF7A7A);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          _buildBudgetCard(),
          const SizedBox(height: 16),
          _buildInsightCard(),
          const SizedBox(height: 32),
          const Text(
            'RECENT',
            style: TextStyle(
              color: textGrey,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          _buildTransactionItem(
            icon: Icons.local_pizza_outlined,
            iconColor: Colors.orangeAccent,
            title: 'Swiggy',
            subtitle: 'Today, 1:42 PM',
            amount: '-₹342',
            showDivider: true,
          ),
          _buildTransactionItem(
            icon: Icons.local_gas_station_outlined,
            iconColor: Colors.redAccent,
            title: 'Indian Oil',
            subtitle: 'Yesterday',
            amount: '-₹500',
            showDivider: true,
          ),
          _buildTransactionItem(
            icon: Icons.wallet,
            iconColor: Colors.grey,
            title: 'Salary',
            subtitle: '25 March',
            amount: '+₹85,000',
            amountColor: accentGreen,
            showDivider: false,
          ),
          // Adding a bit of padding at the bottom so it doesn't hug the nav bar
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Text(
                  'Hey, Adith ',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                Text('👋', style: TextStyle(fontSize: 20)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Friday, 28 March',
              style: TextStyle(
                fontSize: 16,
                color: textGrey.withOpacity(0.8),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withOpacity(0.1), width: 1),
          ),
          child: CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFF1E1E1E),
            child: const Text(
              'AB',
              style: TextStyle(
                color: accentGreen,
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBudgetCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.03), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SPENT THIS MONTH',
            style: TextStyle(
              color: textGrey,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            '₹14,820',
            style: TextStyle(
              color: Colors.white,
              fontSize: 40,
              fontWeight: FontWeight.w700,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 20),
          // Custom Progress Bar
          Stack(
            children: [
              Container(
                height: 6,
                decoration: BoxDecoration(
                  color: const Color(0xFF2C2C2C), // Track color
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              LayoutBuilder(
                builder: (context, constraints) {
                  return Container(
                    height: 6,
                    width: constraints.maxWidth * 0.62, // 62% progress
                    decoration: BoxDecoration(
                      color: accentGreen,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              RichText(
                text: const TextSpan(
                  style: TextStyle(color: textGrey, fontSize: 13),
                  children: [
                    TextSpan(text: '62% of '),
                    TextSpan(text: '₹24,000 ', style: TextStyle(color: Colors.white70)),
                    TextSpan(text: 'budget'),
                  ],
                ),
              ),
              const Text(
                '₹9,180 left',
                style: TextStyle(color: textGrey, fontSize: 13),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInsightCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.03), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4, right: 12),
            height: 10,
            width: 10,
            decoration: const BoxDecoration(
              color: Colors.orangeAccent,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: const TextSpan(
                    style: TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
                    children: [
                      TextSpan(text: 'Spending up '),
                      TextSpan(
                        text: '23%',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(text: ' vs last week'),
                    ],
                  ),
                ),
                const Text(
                  '— mostly Swiggy orders',
                  style: TextStyle(color: textGrey, fontSize: 15, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String amount,
    Color amountColor = expenseRed,
    required bool showDivider,
  }) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12.0),
          child: Row(
            children: [
              Container(
                height: 48,
                width: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFF222222),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: iconColor, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(color: textGrey, fontSize: 13),
                    ),
                  ],
                ),
              ),
              Text(
                amount,
                style: TextStyle(
                  color: amountColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          Divider(
            color: Colors.white.withOpacity(0.05),
            height: 1,
            indent: 64, // Aligns divider with text, skipping the icon
          ),
      ],
    );
  }
}