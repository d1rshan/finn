import 'package:flutter/material.dart';

class StoryScreen extends StatelessWidget {
  const StoryScreen({super.key});

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
            const SizedBox(height: 24),
            _buildSummaryText(),
            const SizedBox(height: 24),
            _buildStatsRow(),
            const SizedBox(height: 32),
            const Text(
              'DAILY SPEND',
              style: TextStyle(
                color: textGrey,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 16),
            _buildBarChart(),
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
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'MARCH 2025',
          style: TextStyle(
            color: accentGreen,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.5,
          ),
        ),
        SizedBox(height: 12),
        Text(
          'A month of late\nnights\nand takeout.',
          style: TextStyle(
            fontSize: 34,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            height: 1.1,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryText() {
    return RichText(
      text: const TextSpan(
        style: TextStyle(
          color: textGrey,
          fontSize: 16,
          height: 1.5,
          fontFamily: 'Rubik', // Ensured to match your global font
        ),
        children: [
          TextSpan(text: 'You spent '),
          TextSpan(text: '₹14,820', style: TextStyle(color: Colors.white)),
          TextSpan(
            text: ' across 31\ntransactions. Food dominated at 32%,\nmostly delivery after 9PM. You saved on\ntravel — down 18% from February.',
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            value: '31',
            valueColor: Colors.white,
            label: 'transactions',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildStatCard(
            value: '-18%',
            valueColor: accentGreen,
            label: 'vs Feb\ntravel',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildStatCard(
            value: '₹478',
            valueColor: Colors.white,
            label: 'avg/day',
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({
    required String value,
    required Color valueColor,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.03), width: 1),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 24,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: textGrey,
              fontSize: 13,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBarChart() {
    // Relative heights representing the dummy daily spend
    final List<double> barHeights = [
      0.25, 0.4, 0.2, 0.9, 0.35, 0.45, 0.35, 0.85, 0.25, 0.4, 0.25, 1.0, 0.2, 0.35
    ];

    return SizedBox(
      height: 80, // Fixed height for the chart area
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.end, // Align bars to the bottom
        children: barHeights.map((heightFactor) {
          // If the bar is a "spike" (tall), make it neon green
          final isSpike = heightFactor > 0.8;
          return Container(
            width: 14,
            height: 80 * heightFactor,
            decoration: BoxDecoration(
              color: isSpike ? accentGreen : const Color(0xFF222222),
              borderRadius: BorderRadius.circular(4),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildInsightCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF13170F), // Subtle greenish dark tint
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accentGreen.withOpacity(0.15), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Lightbulb Icon Box
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: const Icon(
              Icons.lightbulb,
              color: Color(0xFFFFFFA6), // Pale yellow lightbulb color
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
                    color: Color(0xFFA1A1A5),
                  ),
                  children: [
                    TextSpan(text: 'If you\'d cooked '),
                    TextSpan(
                      text: '3× ',
                      style: TextStyle(color: accentGreen, fontWeight: FontWeight.w500),
                    ),
                    TextSpan(text: 'a week, you\'d have saved an estimated '),
                    TextSpan(
                      text: '₹2,400 ',
                      style: TextStyle(color: accentGreen, fontWeight: FontWeight.w500),
                    ),
                    TextSpan(text: 'this month.'),
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