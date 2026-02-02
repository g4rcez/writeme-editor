import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Settings, Check, PanelLeft, Maximize2, Info, AlignLeft, AlignCenter, AlignJustify, Database, FolderSync } from "lucide-react";
import { Link } from "brouther";
import { useState } from "react";
import { SettingsRepository } from "../../store/settings";
import { useUIStore, ContentWidth } from "../../store/ui.store";
import { links } from "../router";
import { StorageConfigDialog } from "./workspace-setup";

const widthOptions: { value: ContentWidth; label: string; icon: React.ElementType }[] = [
  { value: "narrow", label: "Narrow", icon: AlignLeft },
  { value: "medium", label: "Medium", icon: AlignCenter },
  { value: "wide", label: "Wide", icon: AlignJustify },
];

export const SettingsMenu = () => {
  const [state, dispatch] = useUIStore();
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const settings = SettingsRepository.load();
  const hasSync = !!settings.storageDirectory;

  return (
    <>
      <StorageConfigDialog
        open={storageDialogOpen}
        onOpenChange={setStorageDialogOpen}
      />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center justify-center w-8 h-8 rounded-md text-foreground/70 transition-all hover:text-foreground hover:bg-muted/30"
          title="Settings"
          aria-label="Settings menu"
        >
          <Settings className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] bg-background border border-border rounded-lg shadow-lg p-1 z-50 animate-fade-in-scale"
          sideOffset={8}
          align="end"
        >
          {/* Content Width */}
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-foreground/50">
            Content Width
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={state.contentWidth}
            onValueChange={(v) => dispatch.setContentWidth(v as ContentWidth)}
          >
            {widthOptions.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50"
              >
                <option.icon className="w-4 h-4 text-foreground/60" />
                <span className="flex-1">{option.label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="w-4 h-4 text-primary" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          {/* Toggle Options */}
          <DropdownMenu.CheckboxItem
            checked={state.sidebarOpen}
            onCheckedChange={() => dispatch.toggleSidebar()}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50"
          >
            <PanelLeft className="w-4 h-4 text-foreground/60" />
            <span className="flex-1">Show Sidebar</span>
            <DropdownMenu.ItemIndicator>
              <Check className="w-4 h-4 text-primary" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.CheckboxItem>

          <DropdownMenu.CheckboxItem
            checked={state.focusMode}
            onCheckedChange={() => dispatch.toggleFocusMode()}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50"
          >
            <Maximize2 className="w-4 h-4 text-foreground/60" />
            <span className="flex-1">Focus Mode</span>
            <DropdownMenu.ItemIndicator>
              <Check className="w-4 h-4 text-primary" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.CheckboxItem>

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          {/* Storage Configuration */}
          <DropdownMenu.Item
            onSelect={() => setStorageDialogOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50"
          >
            {hasSync ? (
              <FolderSync className="w-4 h-4 text-green-500" />
            ) : (
              <Database className="w-4 h-4 text-blue-500" />
            )}
            <span className="flex-1">Storage: {hasSync ? "Folder Sync" : "Local"}</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          {/* About Link */}
          <DropdownMenu.Item asChild>
            <Link
              href={links.about}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50"
            >
              <Info className="w-4 h-4 text-foreground/60" />
              <span>About</span>
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    </>
  );
};
