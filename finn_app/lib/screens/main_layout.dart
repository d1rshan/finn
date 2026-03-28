import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'log_payment.dart';
import 'insights.dart';
import 'monthly_story.dart';
import 'chat_finn.dart';
void main() {
  runApp(const FinanceApp());
}

class FinanceApp extends StatelessWidget {
  const FinanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Finance Dashboard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0C0C0C), // Dark almost black
        fontFamily: 'Roboto', // Replace with your preferred sans-serif font
      ),
      home: const MainLayout(),
    );
  }
}

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;

  // List of screens to switch between
  final List<Widget> _screens = [
    const HomeScreen(),
    const LogPaymentScreen(), // Placeholders for other tabs
    const InsightsScreen(),
    const StoryScreen(),
    const ChatScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      // Custom Bottom Navigation Bar to match the design exactly
      bottomNavigationBar: Container(
        padding: const EdgeInsets.only(top: 12, bottom: 24, left: 16, right: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF141414), // Dark grey nav background
          border: Border(
            top: BorderSide(color: Colors.white.withOpacity(0.05), width: 1),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavItem(icon: Icons.home_filled, label: 'Home', index: 0),
            _buildNavItem(icon: Icons.radio_button_unchecked, label: 'Log', index: 1),
            _buildNavItem(icon: Icons.auto_awesome, label: 'Insights', index: 2),
            _buildNavItem(icon: Icons.pie_chart_outline, label: 'Story', index: 3),
            _buildNavItem(icon: Icons.cloud_outlined, label: 'Finn', index: 4),
          ],
        ),
      ),
    );
  }

  Widget _buildNavItem({required IconData icon, required String label, required int index}) {
    final isSelected = _currentIndex == index;
    const activeColor = Color(0xFFD4FF26); // Neon green
    const inactiveColor = Color(0xFF737373); // Grey

    return GestureDetector(
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // The little green dot above the active icon
          Container(
            height: 4,
            width: 4,
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(
              color: isSelected ? activeColor : Colors.transparent,
              shape: BoxShape.circle,
            ),
          ),
          Icon(
            icon,
            color: isSelected ? activeColor : inactiveColor,
            size: 26,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: isSelected ? activeColor : inactiveColor,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}