import { isElectron } from "../../lib/is-electron";
import { INoteRepository } from "../note";
import { HashtagsRepository as BrowserHashtagsRepository } from "./browser/hashtags.repository";
import { NotesRepository as BrowserNotesRepository } from "./browser/notes.repository";
import { ProjectsRepository as BrowserProjectsRepository } from "./browser/projects.repository";
import { SettingsRepository as BrowserSettingsRepository } from "./browser/settings.repository";
import { TabsRepository as BrowserTabsRepository } from "./browser/tabs.repository";
import { HashtagsRepository as ElectronHashtagsRepository } from "./electron/hashtags.repository";
import { NotesRepository as ElectronNotesRepository } from "./electron/notes.repository";
import { ProjectsRepository as ElectronProjectsRepository } from "./electron/projects.repository";
import { SettingsRepository as ElectronSettingsRepository } from "./electron/settings.repository";
import { TabsRepository as ElectronTabsRepository } from "./electron/tabs.repository";
import { IHashtagRepository } from "./entities/hashtag";
import { IProjectRepository } from "./entities/project";
import { ISettingsRepository } from "./entities/settings";
import { ITabRepository } from "./entities/tab";

type Result = {
  tabs: ITabRepository;
  notes: INoteRepository;
  hashtags: IHashtagRepository;
  projects: IProjectRepository;
  settings: ISettingsRepository;
};

const getRepositories = (): Result => {
  if (isElectron()) {
    console.log("Using Electron (SQLite) repositories");
    return {
      tabs: new ElectronTabsRepository(),
      notes: new ElectronNotesRepository(),
      hashtags: new ElectronHashtagsRepository(),
      projects: new ElectronProjectsRepository(),
      settings: new ElectronSettingsRepository(),
    };
  } else {
    console.log("Using Browser (Dexie) repositories");
    return {
      tabs: new BrowserTabsRepository(),
      notes: new BrowserNotesRepository(),
      hashtags: new BrowserHashtagsRepository(),
      projects: new BrowserProjectsRepository(),
      settings: new BrowserSettingsRepository(),
    };
  }
};

export const repositories = getRepositories();
