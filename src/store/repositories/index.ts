import { isElectron } from "../../lib/is-electron";
import { type INoteRepository } from "../note";
import { HashtagsRepository as BrowserHashtagsRepository } from "./browser/hashtags.repository";
import { NotesRepository as BrowserNotesRepository } from "./browser/notes.repository";
import { ProjectsRepository as BrowserProjectsRepository } from "./browser/projects.repository";
import { SettingsRepository as BrowserSettingsRepository } from "./browser/settings.repository";
import { TabsRepository as BrowserTabsRepository } from "./browser/tabs.repository";
import { ScriptsRepository as BrowserScriptsRepository } from "./browser/scripts.repository";
import { NoteGroupsRepository as BrowserNoteGroupsRepository } from "./browser/note-groups.repository";
import { NoteGroupMembersRepository as BrowserNoteGroupMembersRepository } from "./browser/note-group-members.repository";
import { HashtagsRepository as ElectronHashtagsRepository } from "./electron/hashtags.repository";
import { NotesRepository as ElectronNotesRepository } from "./electron/notes.repository";
import { ProjectsRepository as ElectronProjectsRepository } from "./electron/projects.repository";
import { SettingsRepository as ElectronSettingsRepository } from "./electron/settings.repository";
import { TabsRepository as ElectronTabsRepository } from "./electron/tabs.repository";
import { ScriptsRepository as ElectronScriptsRepository } from "./electron/scripts.repository";
import { AIRepository as ElectronAIRepository } from "./electron/ai.repository";
import { NoteGroupsRepository as ElectronNoteGroupsRepository } from "./electron/note-groups.repository";
import { NoteGroupMembersRepository as ElectronNoteGroupMembersRepository } from "./electron/note-group-members.repository";
import { type IHashtagRepository } from "./entities/hashtag";
import { type IProjectRepository } from "./entities/project";
import { type ISettingsRepository } from "./entities/settings";
import { type ITabRepository } from "./entities/tab";
import { type IScriptRepository } from "./entities/script";
import { type IAIRepository } from "./entities/ai";
import { type INoteGroupRepository } from "./entities/note-group";
import { type INoteGroupMemberRepository } from "./entities/note-group-member";

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
};

const getRepositories = (): Result => {
  if (isElectron()) {
    console.log("Using Electron (SQLite) repositories");
    const tabs = new ElectronTabsRepository();
    return {
      ai: new ElectronAIRepository(),
      tabs,
      notes: new ElectronNotesRepository(tabs),
      hashtags: new ElectronHashtagsRepository(),
      projects: new ElectronProjectsRepository(),
      settings: new ElectronSettingsRepository(),
      scripts: new ElectronScriptsRepository(),
      noteGroups: new ElectronNoteGroupsRepository(),
      noteGroupMembers: new ElectronNoteGroupMembersRepository(),
    };
  } else {
    console.log("Using Browser (Dexie) repositories");
    const tabs = new BrowserTabsRepository();
    return {
      tabs,
      notes: new BrowserNotesRepository(tabs),
      hashtags: new BrowserHashtagsRepository(),
      projects: new BrowserProjectsRepository(),
      settings: new BrowserSettingsRepository(),
      scripts: new BrowserScriptsRepository(),
      noteGroups: new BrowserNoteGroupsRepository(),
      noteGroupMembers: new BrowserNoteGroupMembersRepository(),
      ai: {
        getChats: async () => [],
        saveChat: async () => {},
        getConfigs: async () => [],
        getMessages: async () => [],
        saveConfig: async () => {},
        saveMessage: async () => {},
        deleteConfig: async () => {},
      },
    };
  }
};

export const repositories = getRepositories();
