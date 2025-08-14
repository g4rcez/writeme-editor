import { createSuggestionsItems } from "@harshtalks/slash-tiptap";
import type { Editor } from "@tiptap/react";

type Suggestion = {
  title: string;
  searchTerms?: string[];
  children?: Omit<Suggestion, "children">[];
  command?: (props: { editor: Editor; range: any }) => void;
};

export const suggestionsList: Suggestion[] = [
  {
    title: "Lists",
    children: [
      {
        title: "Ordered List",
        searchTerms: ["ordered", "point", "numbers"],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: "Bullet List",
        searchTerms: ["unordered", "point"],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
    ],
  },
];

export const suggestions = createSuggestionsItems(
  suggestionsList.flatMap((x): any[] => [x, ...(x.children ?? [])]),
);
