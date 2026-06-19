import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

class AudioService {
  static final AudioService _instance = AudioService._internal();

  factory AudioService() {
    return _instance;
  }

  AudioService._internal();

  final Map<String, AudioPlayer> _players = {};
  bool _muted = false;

  bool get muted => _muted;

  Future<void> initialize() async {
    try {
      const sounds = ['correct', 'wrong', 'tick', 'whoosh', 'fanfare'];
      for (final sound in sounds) {
        final player = AudioPlayer();
        await player.setAsset('assets/sfx/$sound.mp3');
        _players[sound] = player;
      }
    } catch (e) {
      if (kDebugMode) {
        print('AudioService init error: $e');
      }
    }
  }

  void setMuted(bool muted) {
    _muted = muted;
    for (final player in _players.values) {
      player.setVolume(muted ? 0.0 : 1.0);
    }
  }

  Future<void> play(String soundName) async {
    if (_muted) return;
    try {
      final player = _players[soundName];
      if (player != null) {
        await player.seek(Duration.zero);
        await player.play();
      }
    } catch (e) {
      if (kDebugMode) {
        print('AudioService play error: $e');
      }
    }
  }

  Future<void> dispose() async {
    for (final player in _players.values) {
      await player.dispose();
    }
    _players.clear();
  }
}
