import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/tokens.dart';

class CountdownRing extends StatefulWidget {
  final double fraction;
  final Duration duration;
  final VoidCallback? onTick;

  const CountdownRing({
    super.key,
    required this.fraction,
    this.duration = const Duration(seconds: 20),
    this.onTick,
  });

  @override
  State<CountdownRing> createState() => _CountdownRingState();
}

class _CountdownRingState extends State<CountdownRing> {
  late bool _showPulse;

  @override
  void initState() {
    super.initState();
    _updatePulseState();
  }

  @override
  void didUpdateWidget(CountdownRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    _updatePulseState();
  }

  void _updatePulseState() {
    _showPulse = widget.fraction <= 0.15;
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    _updatePulseState();

    return SizedBox(
      width: 160,
      height: 160,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: const Size(160, 160),
            painter: _CountdownRingPainter(fraction: widget.fraction),
          ),
          if (_showPulse && !reduceMotion)
            Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: _getRingColor(widget.fraction).withAlpha(100),
                  width: 2,
                ),
              ),
            ).animate(onPlay: (controller) => controller.repeat()).scale(
                  duration: const Duration(milliseconds: 600),
                  begin: const Offset(1.0, 1.0),
                  end: const Offset(1.05, 1.05),
                ),
        ],
      ),
    );
  }

  Color _getRingColor(double fraction) {
    if (fraction > 0.5) {
      return AppColors.timerGreen;
    } else if (fraction > 0.25) {
      final t = (fraction - 0.25) / 0.25;
      return Color.lerp(
        AppColors.timerAmber,
        AppColors.timerGreen,
        t,
      )!;
    } else {
      final t = fraction / 0.25;
      return Color.lerp(
        AppColors.timerRed,
        AppColors.timerAmber,
        t,
      )!;
    }
  }
}

class _CountdownRingPainter extends CustomPainter {
  final double fraction;

  _CountdownRingPainter({required this.fraction});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    final backgroundPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..color = Colors.white.withAlpha(30);

    canvas.drawCircle(center, radius, backgroundPaint);

    final color = _getRingColor(fraction);
    paint.color = color;

    const startAngle = -90.0 * 3.14159265359 / 180.0;
    final sweepAngle = fraction * 2 * 3.14159265359;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      paint,
    );
  }

  Color _getRingColor(double fraction) {
    if (fraction > 0.5) {
      return const Color(0xFF43A047);
    } else if (fraction > 0.25) {
      final t = (fraction - 0.25) / 0.25;
      return Color.lerp(
        const Color(0xFFFB8C00),
        const Color(0xFF43A047),
        t,
      )!;
    } else {
      final t = fraction / 0.25;
      return Color.lerp(
        const Color(0xFFE53935),
        const Color(0xFFFB8C00),
        t,
      )!;
    }
  }

  @override
  bool shouldRepaint(_CountdownRingPainter oldDelegate) =>
      oldDelegate.fraction != fraction;
}
