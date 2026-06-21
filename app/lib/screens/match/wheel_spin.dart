import 'dart:math';
import 'package:flutter/material.dart';

import '../../data/categories.dart';
import '../../l10n/app_localizations.dart';
import '../../services/audio_service.dart';
import '../../theme/category_colors.dart';
import '../../theme/tokens.dart';

/// Spin-mode category reveal (GDD §4.3): an 8-segment wheel spins and lands on
/// [resultCategory] — the outcome is server-decided (passed in), the spin is pure
/// theater (doc 07 §2.2). Calls [onDone] once it settles. Respects reduced motion
/// (snaps straight to the result).
class WheelSpin extends StatefulWidget {
  const WheelSpin({super.key, required this.resultCategory, required this.onDone});

  final String resultCategory;
  final VoidCallback onDone;

  @override
  State<WheelSpin> createState() => _WheelSpinState();
}

class _WheelSpinState extends State<WheelSpin> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _turns;
  bool _started = false;
  bool _reduced = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    );

    final ids = Categories.ids;
    final segment = 2 * pi / ids.length;
    final targetIx = ids.indexOf(widget.resultCategory).clamp(0, ids.length - 1);
    // Pointer sits at the top (-pi/2). Rotate so the target segment's center
    // aligns under it, plus several full turns for drama.
    final targetAngle = (2 * pi * 4) - (targetIx * segment) - (segment / 2);
    _turns = Tween<double>(begin: 0, end: targetAngle).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutQuart),
    );

    // Only the animated path settles via the status listener; the reduced-motion
    // path drives onDone itself (avoiding a double-fire).
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && !_reduced) {
        Future.delayed(const Duration(milliseconds: 700), () {
          if (mounted) widget.onDone();
        });
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Start once we can read MediaQuery; snap when reduced motion is requested.
    if (_started) return;
    _started = true;
    if (MediaQuery.of(context).disableAnimations) {
      _reduced = true;
      _controller.value = 1.0;
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) widget.onDone();
      });
    } else {
      AudioService().play('whoosh');
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppColors.surfacePrimary,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                l.roundSpinning,
                style: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: AppSpacing.xl),
              SizedBox(
                width: 260,
                height: 260,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    AnimatedBuilder(
                      animation: _turns,
                      builder: (context, _) => Transform.rotate(
                        angle: _turns.value,
                        child: CustomPaint(
                          size: const Size(260, 260),
                          painter: _WheelPainter(),
                        ),
                      ),
                    ),
                    // Fixed pointer at the top.
                    const Positioned(
                      top: 0,
                      child: Icon(Icons.arrow_drop_down, color: Colors.white, size: 40),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WheelPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final ids = Categories.ids;
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    final segment = 2 * pi / ids.length;
    final paint = Paint()..style = PaintingStyle.fill;

    for (var i = 0; i < ids.length; i++) {
      paint.color = CategoryColors.getColor(ids[i]);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -pi / 2 + i * segment,
        segment,
        true,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
