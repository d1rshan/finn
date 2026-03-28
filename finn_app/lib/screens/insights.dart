import 'package:flutter/material.dart';

class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key});

  // Reusable colors matching your design
  static const Color bgColor = Color(0xFF0C0C0C);
  static const Color cardColor = Color(0xFF161616);
  static const Color accentGreen = Color(0xFFD4FF26);
  static const Color textGrey = Color(0xFF8A8A8E);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
          children: [
            _buildHeader(),
            const SizedBox(height: 32),
            _buildGrid(),
            const SizedBox(height: 24),
            _buildInsightCard(),
            // Extra padding at the bottom for the nav bar
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Your patterns',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w600,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'March 2025 · 31 transactions',
          style: TextStyle(
            fontSize: 16,
            color: textGrey.withOpacity(0.8),
            fontWeight: FontWeight.w400,
          ),
        ),
      ],
    );
  }

  Widget _buildGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      shrinkWrap: true, // Important: allows GridView to live inside ListView
      physics: const NeverScrollableScrollPhysics(), // Disables grid's own scrolling
      childAspectRatio: 0.95, // Adjusts the height/width ratio of the cards
      children: [
        _buildCategoryCard(
          iconWidget: const Text('🍔', style: TextStyle(fontSize: 28)),
          title: 'Food',
          amount: '₹4,820',
          progress: 0.7, // 70% full
        ),
        _buildCategoryCard(
          iconWidget: const Text('🚗', style: TextStyle(fontSize: 28)),
          title: 'Transport',
          amount: '₹2,100',
          progress: 0.35, // 35% full
        ),
        _buildCategoryCard(
          iconWidget: const Icon(Icons.shopping_cart_outlined, color: textGrey, size: 28),
          title: 'Shopping',
          amount: '₹3,400',
          progress: 0.5, // 50% full
        ),
        _buildCategoryCard(
          iconWidget: const Icon(Icons.bolt, color: Colors.orangeAccent, size: 28),
          title: 'Bills',
          amount: '₹1,600',
          progress: 0.25, // 25% full
        ),
      ],
    );
  }

  Widget _buildCategoryCard({
    required Widget iconWidget,
    required String title,
    required String amount,
    required double progress,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.03), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          iconWidget,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: textGrey,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                amount,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              // Custom Progress Bar
              Stack(
                children: [
                  Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2C2C2C),
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      return Container(
                        height: 4,
                        width: constraints.maxWidth * progress,
                        decoration: BoxDecoration(
                          color: accentGreen,
                          borderRadius: BorderRadius.circular(10),
                        ),
                      );
                    },
                  ),
                ],
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
        color: const Color(0xFF13170F), // A very subtle greenish-dark-grey tint
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accentGreen.withOpacity(0.15), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Lightning Icon Box
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: const Icon(
              Icons.bolt,
              color: accentGreen,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          // Insight Text
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 4.0),
              child: RichText(
                text: const TextSpan(
                  style: TextStyle(
                    fontSize: 16,
                    height: 1.5,
                    color: Color(0xFFA1A1A5), // Slightly lighter grey for readability
                  ),
                  children: [
                    TextSpan(
                      text: 'Pattern spotted: ',
                      style: TextStyle(
                        color: accentGreen,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    TextSpan(
                      text: 'You spend 40% more on weekends. Last 4 Saturdays averaged ₹1,200 each.',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}