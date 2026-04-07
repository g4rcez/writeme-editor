import { isElectron } from "../../lib/is-electron";
import { type INoteRepository } from "../note";
import { HashtagsRepository as BrowserHashtagsRepository } from "./browser/hashtags.repository";
import { NotesRepository as BrowserNotesRepository } from "./browser/notes.repository";
import { TabsRepository as BrowserTabsRepository } from "./browser/tabs.repository";
import { NoteGroupsRepository as BrowserNoteGroupsRepository } from "./browser/note-groups.repository";
import { NoteGroupMembersRepository as BrowserNoteGroupMembersRepository } from "./browser/note-group-members.repository";
import { ViewsRepository as BrowserViewsRepository } from "./browser/views.repository";
import { HashtagsRepository as ElectronHashtagsRepository } from "./electron/hashtags.repository";
import { NotesRepository as ElectronNotesRepository } from "./electron/notes.repository";
import { TabsRepository as ElectronTabsRepository } from "./electron/tabs.repository";
import { AIRepository as ElectronAIRepository } from "./electron/ai.repository";
import { NoteGroupsRepository as ElectronNoteGroupsRepository } from "./electron/note-groups.repository";
import { NoteGroupMembersRepository as ElectronNoteGroupMembersRepository } from "./electron/note-group-members.repository";
import { ViewsRepository as ElectronViewsRepository } from "./electron/views.repository";
import { type IHashtagRepository } from "./entities/hashtag";
import { type IProjectRepository } from "./entities/project";
import { type ISettingsRepository } from "./entities/settings";
import { type ITabRepository } from "./entities/tab";
import { type IScriptRepository } from "./entities/script";
import { type IAIRepository } from "./entities/ai";
import { BrowserAIRepository } from "./browser/ai.repository";
import { type INoteGroupRepository } from "./entities/note-group";
import { type INoteGroupMemberRepository } from "./entities/note-group-member";
import { type IViewRepository } from "./entities/view";
import { DexieStorageAdapter } from "./adapters/dexie.adapter";
import { ElectronStorageAdapter } from "./adapters/electron.adapter";
import { SettingsRepository } from "./shared/settings.repository";
import { ProjectsRepository } from "./shared/projects.repository";
import { ScriptsRepository } from "./shared/scripts.repository";

type Result = {
  ai: IAIRepository;
  tabs: ITabRepository;
  notes: INoteRepository;
  hashtags: IHashtagRepository;
  projects: IProjectRepository;
  settings: ISettingsRepository;
  scripts: IScriptRepository;
  noteGroups: INoteGroupRepository;
  noteGroupMembers: INoteGroupMemberRepository;
  views: IViewRepository;
};

const getRepositories = (): Result => {
  if (isElectron()) {
    console.log("Using Electron (SQLite) repositories");
    const adapter = new ElectronStorageAdapter();
    const tabs = new ElectronTabsRepository();
    return {
      ai: new ElectronAIRepository(),
      tabs,
      notes: new ElectronNotesRepository(tabs),
      hashtags: new ElectronHashtagsRepository(),
      projects: new ProjectsRepository(adapter),
      settings: new SettingsRepository(adapter),
      scripts: new ScriptsRepository(adapter),
      noteGroups: new ElectronNoteGroupsRepository(),
      noteGroupMembers: new ElectronNoteGroupMembersRepository(),
      views: new ElectronViewsRepository(),
    };
  } else {
    console.log("Using Browser (Dexie) repositories");
    const adapter = new DexieStorageAdapter();
    const tabs = new BrowserTabsRepository();
    return {
      tabs,
      notes: new BrowserNotesRepository(tabs),
      hashtags: new BrowserHashtagsRepository(),
      projects: new ProjectsRepository(adapter),
      settings: new SettingsRepository(adapter),
      scripts: new ScriptsRepository(adapter),
      noteGroups: new BrowserNoteGroupsRepository(),
      noteGroupMembers: new BrowserNoteGroupMembersRepository(),
      ai: new BrowserAIRepository(),
      views: new BrowserViewsRepository(),
    };
  }
};

export const repositories = getRepositories();
