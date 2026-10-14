# Vim scripts and store builds

Policy review: 2026-10-13.

The `vimMode` preference enables packaged Vim behavior in both editor types on
every distribution. The separate immutable `vimScripts` capability governs
execution of user-provided TypeScript initialization code.

| Distribution              | Built-in Vim | init.ts execution                                      |
| ------------------------- | ------------ | ------------------------------------------------------ |
| macOS App Store           | Available    | Excluded                                               |
| iOS App Store             | Available    | Excluded                                               |
| Android Google Play       | Available    | Excluded                                               |
| Desktop direct / Homebrew | Available    | Available                                              |
| Web direct                | Available    | Available                                              |
| Mobile direct             | Available    | Disabled, consistent with existing mobile capabilities |

## Policy findings

Apple rule 2.5.2 restricts execution of code that introduces or changes app
features and functionality, with a limited educational exception. Mac App Store
rule 2.4.5(iv) restricts downloading or installing additional code/resources that
add functionality or materially change the reviewed app. Rule 4.7 permits certain
types of plug-ins and other software under additional conditions. Writeme does
not assume its user-defined initialization scripts qualify for an exception.
Disabling the runner is a conservative release decision, rather than a claim
that every editable keybinding is prohibited. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Google Play prohibits app self-updates and downloading executable code outside
its update mechanism, while explicitly exempting code executed by an interpreter
or virtual machine with indirect Android API access, such as JavaScript in a
WebView. Runtime interpreted code must still avoid violations of all Play
policies. Google does not categorically prohibit this JavaScript feature;
Writeme disables it in the Google Play build to preserve its existing restricted
capability policy. [Google Play Device and Network Abuse policy](https://support.google.com/googleplay/android-developer/answer/18258653?hl=en).

## Enforcement and verification

- `resolveBuildProfile` makes `vimScripts` false for all store profiles. Feature
  overrides can only disable capabilities; attempts to enable them through the
  environment are rejected.
- The settings UI keeps the basic toggle available and omits the TypeScript
  editor in restricted builds.
- The configuration loader ignores saved source when the capability is false.
  The compiler and evaluator also check the capability at their entry points.
- The build plugin replaces the entire `app/vim/scripts/` execution boundary
  before following imports, removing Sucrase and the configuration worker from
  the runtime graph. Any remaining disabled entry stub throws on invocation.
- Tests compile the evaluator under macOS, iOS, and Google Play store profiles
  and verify it cannot execute source and does not include Sucrase. Browser
  profile tests cover hidden script controls, attempts to override flags, and
  ordinary Vim editing with a stored init.ts that would otherwise throw.

These checks verify this feature boundary. Signing and submission continue to
use the existing platform release process.
