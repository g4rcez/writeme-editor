type NoteStarter = {
    id: string;
    title: string;
    description: string;
    content: string;
};

export const NOTE_STARTERS: readonly NoteStarter[] = [
    {
        id: "project-brief",
        title: "Project brief",
        description: "Define the goal, scope, and next steps for a project.",
        content:
            "## Goal\n\nWhat problem are we solving, and for whom?\n\n## Success\n\nHow will we know this worked?\n\n## Scope\n\n- Included:\n- Outside this project:\n\n## Next steps\n\n- [ ] Define the problem\n- [ ] Choose the first milestone\n- [ ] Review the result\n",
    },
    {
        id: "reading-notes",
        title: "Reading notes",
        description: "Capture key ideas, questions, and what to do with a reading.",
        content:
            "## Source\n\nTitle, author, and link:\n\n## Key ideas\n\n- \n\n## In my own words\n\nWhat is the main argument?\n\n## Questions\n\n- \n\n## Put it into practice\n\n- [ ] Try one idea\n",
    },
    {
        id: "weekly-review",
        title: "Weekly review",
        description: "Reflect on the week and choose what matters next.",
        content:
            "## What went well\n\n- \n\n## What I learned\n\n- \n\n## Loose ends\n\n- [ ] Follow up\n\n## Next week's priorities\n\n1. \n2. \n3. \n\n## One thing to change\n\nWhat would make next week easier?\n",
    },
    {
        id: "markdown-playground",
        title: "Markdown playground",
        description: "Try headings, tasks, code, and tables in the editor.",
        content:
            '## Try Markdown\n\nWrite **bold** or *italic* text.\n\n### Tasks\n\n- [ ] Try editing this note\n- [x] Create a note from an example\n\n### Code\n\n```typescript\nconst greeting = "Hello, writeme";\n```\n\n### Table\n\n| Idea | Next step |\n| --- | --- |\n| A useful note | Make it your own |\n\n> Replace this example with your own thoughts.\n',
    },
];
