import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/audio_service.dart';
import '../services/haptics_service.dart';

/// Device-local user preferences. Sound + haptics are device-only (never synced);
/// language is local here and ALSO mirrored to the whitelisted `users/{uid}.language`
/// profile field (the Settings screen handles the profile write in Phase 6b).
@immutable
class Settings {
  const Settings({
    this.soundEnabled = true,
    this.hapticsEnabled = true,
    this.languageCode = 'he',
  });

  final bool soundEnabled;
  final bool hapticsEnabled;
  final String languageCode;

  Locale get locale => Locale(languageCode);

  Settings copyWith({bool? soundEnabled, bool? hapticsEnabled, String? languageCode}) =>
      Settings(
        soundEnabled: soundEnabled ?? this.soundEnabled,
        hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
        languageCode: languageCode ?? this.languageCode,
      );
}

const _kSound = 'pref.soundEnabled';
const _kHaptics = 'pref.hapticsEnabled';
const _kLanguage = 'pref.languageCode';

/// Persists settings via shared_preferences and applies device-effecting ones
/// (mute on [AudioService], enable flag on [HapticsService]) on load and change.
/// Starts from defaults synchronously, then hydrates from disk asynchronously.
class SettingsNotifier extends Notifier<Settings> {
  SharedPreferences? _prefs;

  @override
  Settings build() {
    _load();
    return const Settings();
  }

  Future<SharedPreferences> get _store async =>
      _prefs ??= await SharedPreferences.getInstance();

  Future<void> _load() async {
    final prefs = await _store;
    final loaded = Settings(
      soundEnabled: prefs.getBool(_kSound) ?? true,
      hapticsEnabled: prefs.getBool(_kHaptics) ?? true,
      languageCode: prefs.getString(_kLanguage) ?? 'he',
    );
    state = loaded;
    _apply(loaded);
  }

  void _apply(Settings s) {
    AudioService().setMuted(!s.soundEnabled);
    HapticsService().enabled = s.hapticsEnabled;
  }

  Future<void> setSoundEnabled(bool value) async {
    state = state.copyWith(soundEnabled: value);
    _apply(state);
    final prefs = await _store;
    await prefs.setBool(_kSound, value);
  }

  Future<void> setHapticsEnabled(bool value) async {
    state = state.copyWith(hapticsEnabled: value);
    _apply(state);
    final prefs = await _store;
    await prefs.setBool(_kHaptics, value);
  }

  Future<void> setLanguage(String code) async {
    state = state.copyWith(languageCode: code);
    final prefs = await _store;
    await prefs.setString(_kLanguage, code);
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, Settings>(SettingsNotifier.new);

/// The active locale, watched by MaterialApp so a language switch applies live
/// (flips RTL with no restart).
final localeProvider = Provider<Locale>((ref) => ref.watch(settingsProvider).locale);
