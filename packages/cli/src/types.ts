export type NoteType = "note" | "quick" | "read-it-later" | "template";

export type Note = {
  id: string;
  title: string;
  content: string | null;
  noteType: string;
  filePath: string | null;
  tags: string | null;
  project: string | null;
  createdAt: string;
  updatedAt: string;
  favorite: number;
  url: string | null;
  description: string | null;
};

export type Hashtag = {
  id: string;
  hashtag: string;
  filename: string;
  project: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Setting = {
  id: string;
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  title: string;
  folderPath: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};
