import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/social_models.dart';
import '../../router/routes.dart';
import '../../services/social_service.dart';
import '../../theme/tokens.dart';

/// Add a friend by @username search, or by entering/scanning an invite code
/// (GDD §10.1). Sending a request is mutual (request → accept); redeeming a code
/// is instant (+ an optional auto-duel vs the inviter).
class AddFriendScreen extends ConsumerStatefulWidget {
  const AddFriendScreen({super.key});

  @override
  ConsumerState<AddFriendScreen> createState() => _AddFriendScreenState();
}

class _AddFriendScreenState extends ConsumerState<AddFriendScreen> {
  final _searchCtl = TextEditingController();
  final _codeCtl = TextEditingController();
  List<UserSearchResult> _results = const [];
  final Set<String> _requested = {};
  bool _searching = false;

  SocialApi get _api => ref.read(socialApiProvider);

  @override
  void dispose() {
    _searchCtl.dispose();
    _codeCtl.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = _searchCtl.text.trim();
    if (q.isEmpty) return;
    setState(() => _searching = true);
    try {
      final res = await _api.searchUsername(q);
      if (mounted) setState(() => _results = res);
    } catch (_) {
      if (mounted) setState(() => _results = const []);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _send(UserSearchResult u) async {
    final l = AppLocalizations.of(context);
    try {
      await _api.sendFriendRequest(u.uid);
      if (!mounted) return;
      setState(() => _requested.add(u.uid));
      _snack(l.addFriendSent);
    } catch (_) {
      if (mounted) _snack(l.commonError);
    }
  }

  Future<void> _redeem(String code) async {
    final l = AppLocalizations.of(context);
    if (code.trim().length != 8) {
      _snack(l.inviteCodeInvalid);
      return;
    }
    try {
      final r = await _api.redeemInviteCode(code.trim());
      if (!mounted) return;
      _snack(l.inviteRedeemed);
      if (r.autoMatchId != null) {
        context.go(Routes.match(r.autoMatchId!));
      } else {
        context.pop();
      }
    } catch (_) {
      if (mounted) _snack(l.commonError);
    }
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.friendsAddTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          // --- username search ---
          TextField(
            controller: _searchCtl,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _search(),
            decoration: InputDecoration(
              labelText: l.addFriendSearchHint,
              prefixText: '@',
              suffixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: _search,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (_searching) const Center(child: CircularProgressIndicator()),
          ..._results.map((u) => Card(
                child: ListTile(
                  title: Text(u.displayName.isEmpty ? u.username : u.displayName),
                  subtitle: Text('@${u.username}'),
                  trailing: _requested.contains(u.uid)
                      ? Text(l.addFriendSent,
                          style: const TextStyle(color: AppColors.success))
                      : TextButton(
                          onPressed: () => _send(u),
                          child: Text(l.addFriendSend),
                        ),
                ),
              )),

          const Divider(height: AppSpacing.xl),

          // --- invite code ---
          Text(l.inviteCodeTitle, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _codeCtl,
            textCapitalization: TextCapitalization.none,
            decoration: InputDecoration(
              labelText: l.inviteCodeHint,
              suffixIcon: IconButton(
                icon: const Icon(Icons.arrow_forward),
                onPressed: () => _redeem(_codeCtl.text),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            icon: const Icon(Icons.qr_code_scanner),
            label: Text(l.scanQrTitle),
            onPressed: () async {
              final code = await context.push<String>(Routes.friendsScanPath);
              if (code != null && code.isNotEmpty) await _redeem(code);
            },
          ),
        ],
      ),
    );
  }
}
