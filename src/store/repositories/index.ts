import { isElectron } from "../../lib/is-electron";
import { type INoteRepository } from "../note";
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
import { type IHashtagRepository } from "./entities/hashtag";
import { type IProjectRepository } from "./entities/project";
import { type ISettingsRepository } from "./entities/settings";
import { type ITabRepository } from "./entities/tab";
import { type IScriptRepository } from "./entities/script";
import { type IAIRepository } from "./entities/ai";

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
    const tabs = new ElectronTabsRepository();
    return {
      ai: new ElectronAIRepository(),
      tabs,
      notes: new ElectronNotesRepository(tabs),
      hashtags: new ElectronHashtagsRepository(),
      projects: new ElectronProjectsRepository(),
      settings: new ElectronSettingsRepository(),
      scripts: new ElectronScriptsRepository(),
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
