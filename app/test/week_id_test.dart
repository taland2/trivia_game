import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/state/weekly_providers.dart';

// clientWeekId must mirror the server's weekId() (functions/src/economy/weekId.ts):
// ISO-8601 week with the week-NUMBERING year (Thursday rule), formatted YYYY-Www.
// Parity matters — the client listens to weekly/{weekId}/boards/{uid} by this id.

void main() {
  test('formats a mid-year date as the ISO week', () {
    // 2026-06-25 is a Thursday → ISO week 26 of 2026.
    expect(clientWeekId(DateTime(2026, 6, 25)), '2026-W26');
  });

  test('Jan 1 belonging to W01 of its own year', () {
    // 2026-01-01 is a Thursday, so its week belongs to 2026.
    expect(clientWeekId(DateTime(2026, 1, 1)), '2026-W01');
  });

  test('late-December date rolls into the next week-numbering year', () {
    // Mon 2025-12-29's Thursday is 2026-01-01 → it belongs to 2026-W01.
    expect(clientWeekId(DateTime(2025, 12, 29)), '2026-W01');
  });

  test('early-January date can belong to the previous year', () {
    // 2022-01-01 is a Saturday; its Thursday is 2021-12-30 → 2021-W52.
    expect(clientWeekId(DateTime(2022, 1, 1)), '2021-W52');
  });
}
