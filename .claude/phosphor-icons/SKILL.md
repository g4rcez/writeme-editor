---
name: phosphor-icons
description: Use when adding, changing, or migrating icons in a frontend project. Enforces @phosphor-icons/react with the duotone weight, Icon-suffixed names, and the IconContext.Provider global default pattern. Forbids lucide-react.
---

## Rule

Always use `@phosphor-icons/react`. Never import from `lucide-react`. All icons must use the Phosphor `Icon`-suffixed export name. The default weight is `duotone`, set globally — do not add `weight` props at call sites unless intentionally overriding.

## Import pattern

```tsx
// Correct: named import with Icon suffix
import { ShieldIcon, ArrowLeftIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

// Wrong: no suffix, or from wrong package
import { Shield } from "@phosphor-icons/react";      // missing suffix
import { ShieldIcon } from "lucide-react";            // wrong package
import { Shield as ShieldIcon } from "lucide-react";  // wrong package + alias
```

## Global weight (duotone default)

Set once at the React root in `src/main.tsx`. Do not repeat `weight="duotone"` at every call site.

```tsx
import { IconContext } from "@phosphor-icons/react";

<IconContext.Provider value={{ weight: "duotone" }}>
  <App />
</IconContext.Provider>
```

Override per-icon only when intentional:

```tsx
<CheckCircleIcon weight="fill" />  // override for one icon only
```

## Typing icon props

Use the `Icon` type exported from `@phosphor-icons/react` (replaces the old `LucideIcon` type from lucide-react).

```tsx
import type { Icon } from "@phosphor-icons/react";

interface CardProps {
  icon: Icon;
}
```

## Checklist (run before marking icon work done)

- [ ] No `from "lucide-react"` import remains in the file
- [ ] Every icon name ends with `Icon` (e.g. `ShieldIcon`, not `Shield`)
- [ ] No `as *Icon` alias in imports (redundant — Phosphor already has the suffix)
- [ ] No `weight="duotone"` prop on individual icons (default is set globally)
- [ ] Icon prop types use `Icon` from `@phosphor-icons/react`, not `LucideIcon`

## Lucide → Phosphor name table

Key differences (names that don't follow the simple `Foo → FooIcon` pattern):

| Lucide | Phosphor |
|--------|----------|
| Search | MagnifyingGlassIcon |
| Home | HouseIcon |
| Settings / Settings2 | GearIcon |
| ChevronDown/Left/Right/Up | CaretDown/Left/Right/UpIcon |
| Mail | EnvelopeIcon |
| Filter | FunnelIcon |
| LogOut | SignOutIcon |
| Trash2 | TrashIcon |
| Sparkles | SparkleIcon |
| Loader / Loader2 | CircleNotchIcon |
| Edit / Edit2 / Edit3 | PencilSimpleIcon |
| ExternalLink | ArrowSquareOutIcon |
| EyeOff | EyeSlashIcon |
| HelpCircle | QuestionIcon |
| Layers | StackIcon |
| LayoutDashboard | SquaresFourIcon |
| LayoutGrid | GridFourIcon |
| Grid3x3 | GridFourIcon |
| MoreVertical | DotsThreeVerticalIcon |
| BarChart2 / BarChart3 | ChartBarIcon / ChartBarHorizontalIcon |
| PieChart | ChartPieIcon |
| TrendingUp / TrendingDown | TrendUpIcon / TrendDownIcon |
| Pin / PinOff | PushPinIcon / PushPinSlashIcon |
| WifiOff | WifiSlashIcon |
| Maximize2 / Minimize2 | ArrowsOutIcon / ArrowsInIcon |
| RefreshCw | ArrowsCounterClockwiseIcon |
| Share2 | ShareIcon |
| Link2 | LinkIcon |
| DollarSign | CurrencyDollarIcon |
| Bitcoin | CurrencyBtcIcon |
| Twitter | XLogoIcon |
| Facebook | FacebookLogoIcon |
| Instagram | InstagramLogoIcon |
| Linkedin | LinkedinLogoIcon |
| Youtube | YoutubeLogoIcon |
| Save | FloppyDiskIcon |
| Scale | ScalesIcon |
| Zap | LightningIcon |
| ZoomIn / ZoomOut | MagnifyingGlassPlusIcon / MagnifyingGlassMinusIcon |
| SearchX | MagnifyingGlassMinusIcon |
| MessageSquare | ChatTextIcon |
| MessageCircle | ChatCircleIcon |
| MessageCircleMore | ChatCircleDotsIcon |
| MessageSquareWarning | WarningCircleIcon |
| AlertCircle | WarningCircleIcon |
| AlertTriangle | WarningIcon |
| AlertOctagon | WarningOctagonIcon |
| Smile / Meh / Frown | SmileyIcon / SmileyMehIcon / SmileySadIcon |
| Bot | RobotIcon |
| Smartphone | DeviceMobileIcon |
| Store | StorefrontIcon |
| Server | ComputerTowerIcon |
| Award | TrophyIcon |
| Gem | DiamondIcon |
| Inbox | TrayIcon |
| Bookmark | BookmarkSimpleIcon |
| Music / Music2 | MusicNoteIcon |
| AudioLines | WaveformIcon |
| Logs | ListBulletsIcon |
| Languages | TranslateIcon |
| Workflow | FlowArrowIcon |
| Radar | BroadcastIcon |
| Ban | ProhibitIcon |
| ShieldAlert | ShieldWarningIcon |
| ShieldX | ShieldSlashIcon |
| ShieldQuestion | ShieldChevronIcon |
| UserRound / UsersRound | UserIcon / UsersIcon |
| UserCircle2 | UserCircleIcon |
| UserSearch | UserListIcon |
| UserX | UserMinusIcon |
| WalletCards | WalletIcon |
| Forward | ArrowBendRightUpIcon |
| Reply | ArrowBendUpLeftIcon |
| Send | PaperPlaneTiltIcon |
| ClipboardList | ClipboardTextIcon |
| FileArchive | FileArchiveIcon |
| FileSearch | FileSearchIcon |
| FileVideo | FileVideoIcon |
| FileDown / FileUp | FileArrowDownIcon / FileArrowUpIcon |
| Plane | AirplaneIcon |
| PlaneTakeoff | AirplaneTakeoffIcon |
| Unlock | LockOpenIcon |
| SquareX | XSquareIcon |
| ArrowUpDown | CaretUpDownIcon |
| Building2 | BuildingOfficeIcon |
