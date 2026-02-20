import { isElectron } from "../../lib/is-electron";
import { INoteRepository } from "../note";
import { HashtagsRepository as BrowserHashtagsRepository } from "./browser/hashtags.repository";
import { NotesRepository as BrowserNotesRepository } from "./browser/notes.repository";
import { ProjectsRepository as BrowserProjectsRepository } from "./browser/projects.repository";
import { SettingsRepository as BrowserSettingsRepository } from "./browser/settings.repository";
import { TabsRepository as BrowserTabsRepository } from "./browser/tabs.repository";
import { ScriptsRepository as BrowserScriptsRepository } from "./browser/scripts.repository";
import { HashtagsRepository as ElectronHashtagsRepository } from "./electron/hashtags.repository";
import { NotesRepository as ElectronNotesRepository } from "./electron/notes.repository";
import { ProjectsRepository as ElectronProjectsRepository } from "./electron/projects.repository";
import { SettingsRepository as ElectronSettingsRepository } from "./electron/settings.repository";
import { TabsRepository as ElectronTabsRepository } from "./electron/tabs.repository";
import { ScriptsRepository as ElectronScriptsRepository } from "./electron/scripts.repository";
import { AIRepository as ElectronAIRepository } from "./electron/ai.repository";
import { IHashtagRepository } from "./entities/hashtag";
import { IProjectRepository } from "./entities/project";
import { ISettingsRepository } from "./entities/settings";
import { ITabRepository } from "./entities/tab";
import { IScriptRepository } from "./entities/script";
import { IAIRepository } from "./entities/ai";

type Result = {
  ai: IAIRepository;
  tabs: ITabRepository;
  notes: INoteRepository;
  hashtags: IHashtagRepository;
  projects: IProjectRepository;
  settings: ISettingsRepository;
  scripts: IScriptRepository;
};

const getRepositories = (): Result => {
  if (isElectron()) {
    console.log("Using Electron (SQLite) repositories");
    return {
      ai: new ElectronAIRepository(),
      tabs: new ElectronTabsRepository(),
      notes: new ElectronNotesRepository(),
      hashtags: new ElectronHashtagsRepository(),
      projects: new ElectronProjectsRepository(),
      settings: new ElectronSettingsRepository(),
      scripts: new ElectronScriptsRepository(),
    };
  } else {
    console.log("Using Browser (Dexie) repositories");
    return {
      tabs: new BrowserTabsRepository(),
      notes: new BrowserNotesRepository(),
      hashtags: new BrowserHashtagsRepository(),
      projects: new BrowserProjectsRepository(),
      settings: new BrowserSettingsRepository(),
      scripts: new BrowserScriptsRepository(),
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
