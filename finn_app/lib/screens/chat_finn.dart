import 'package:flutter/material.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  // Reusable colors matching your design
  static const Color bgColor = Color(0xFF0C0C0C);
  static const Color aiBubbleColor = Color(0xFF161616);
  static const Color userBubbleColor = Color(0xFFD4FF26);
  static const Color accentGreen = Color(0xFFD4FF26);
  static const Color textGrey = Color(0xFF8A8A8E);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Divider(color: Colors.white.withOpacity(0.05), height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                children: [
                  _buildAiMessage(
                    textSpans: [
                      const TextSpan(text: 'Hey Adith — you\'ve spent '),
                      const TextSpan(
                        text: '₹2,340\non food',
                        style: TextStyle(color: accentGreen),
                      ),
                      const TextSpan(
                        text: ' this week. That\'s 3× your\nusual. Want me to break it down?',
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildUserMessage('Yeah show me'),
                  const SizedBox(height: 16),
                  _buildAiMessage(
                    textSpans: [
                      const TextSpan(
                        text: '6 Zomato',
                        style: TextStyle(color: accentGreen),
                      ),
                      const TextSpan(text: ' orders — avg ₹390. '),
                      const TextSpan(
                        text: '2\ncafé visits',
                        style: TextStyle(color: accentGreen),
                      ),
                      const TextSpan(
                        text: ' — ₹560 total. The spike\nstarted Tuesday after 9PM. Late\nnight orders 🌙',
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildUserMessage('Am I okay for the month?'),
                  const SizedBox(height: 16),
                  _buildAiMessage(
                    textSpans: [
                      const TextSpan(text: 'You\'re at '),
                      const TextSpan(
                        text: '62% of budget',
                        style: TextStyle(color: accentGreen),
                      ),
                      const TextSpan(
                        text: ' with 3\ndays left. If you stay under\n₹400/day, you\'ll close March in the\ngreen.',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            _buildInputArea(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
      child: Row(
        children: [
          // Finn Logo
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
              color: accentGreen,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: const Text(
              'F',
              style: TextStyle(
                color: Colors.black,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 16),
          // Title
          const Text(
            'Finn',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          // Online Indicator Dot
          Container(
            height: 8,
            width: 8,
            decoration: const BoxDecoration(
              color: accentGreen,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAiMessage({required List<TextSpan> textSpans}) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(right: 40), // Prevents bubble from stretching full width
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: aiBubbleColor,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
            bottomRight: Radius.circular(20),
            bottomLeft: Radius.circular(4), // Slightly sharper corner to indicate tail
          ),
          border: Border.all(color: Colors.white.withOpacity(0.03), width: 1),
        ),
        child: RichText(
          text: TextSpan(
            style: const TextStyle(
              color: Color(0xFFD1D1D6), // Very light grey for main AI text
              fontSize: 16,
              height: 1.4,
              fontFamily: 'Rubik', // Ensure it uses your global font
            ),
            children: textSpans,
          ),
        ),
      ),
    );
  }

  Widget _buildUserMessage(String text) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(left: 60), // Prevents bubble from stretching full width
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          color: userBubbleColor,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
            bottomLeft: Radius.circular(20),
            bottomRight: Radius.circular(4), // Sharper corner for user tail
          ),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.black,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.only(left: 20, right: 20, bottom: 24, top: 12),
      color: bgColor,
      child: Container(
        decoration: BoxDecoration(
          color: aiBubbleColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
        ),
        child: Row(
          children: [
            const Expanded(
              child: TextField(
                style: TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Ask Finn anything...',
                  hintStyle: TextStyle(color: textGrey, fontSize: 15),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Container(
                height: 40,
                width: 40,
                decoration: BoxDecoration(
                  color: accentGreen,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: IconButton(
                  icon: const Icon(Icons.arrow_forward, color: Colors.black, size: 20),
                  onPressed: () {
                    // Handle send message
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}