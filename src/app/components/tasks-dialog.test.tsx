import { describe, it, expect, vi } from "vitest";
import { parseEditorTasks, updateTaskContent, addTaskToStack } from "./tasks-dialog";

describe("parseEditorTasks", () => {
  it("should parse H1 and H2 headings as stacks", () => {
    const mockDoc: any = {
      content: { size: 100 },
      descendants: (cb: any) => {
        // # H1
        cb({ type: { name: "heading" }, attrs: { level: 1 }, textContent: "H1 title" }, 0);
        // - [ ] Task 1
        cb({ type: { name: "taskList" } }, 10);
        cb({ 
          type: { name: "taskItem" }, 
          attrs: { checked: false }, 
          nodeSize: 5, 
          forEach: (f: any) => f({ type: { name: "paragraph" }, textContent: "Task 1" }, 0) 
        }, 11);
        
        // ## H2
        cb({ type: { name: "heading" }, attrs: { level: 2 }, textContent: "H2 title" }, 20);
        // - [x] Task 2
        cb({ type: { name: "taskList" } }, 30);
        cb({ 
          type: { name: "taskItem" }, 
          attrs: { checked: true }, 
          nodeSize: 5, 
          forEach: (f: any) => f({ type: { name: "paragraph" }, textContent: "Task 2" }, 0) 
        }, 31);
      }
    };

    const stacks = parseEditorTasks(mockDoc);
    
    expect(stacks).toHaveLength(2);
    expect(stacks[0].title).toBe("H1 title");
    expect(stacks[0].cards).toHaveLength(1);
    expect(stacks[0].cards[0].title).toBe("Task 1");
    expect(stacks[0].cards[0].titlePos).toBe(12); // 11 + 0 + 1

    expect(stacks[1].title).toBe("H2 title");
    expect(stacks[1].cards).toHaveLength(1);
    expect(stacks[1].cards[0].title).toBe("Task 2");
  });
});

describe("updateTaskContent", () => {
  it("should dispatch transaction to update title", () => {
    const mockTr: any = {
      insertText: vi.fn(),
    };
    const mockEditor: any = {
      state: {
        doc: {
          nodeAt: vi.fn().mockReturnValue({ type: { name: "paragraph" }, nodeSize: 10 }),
        },
        tr: mockTr,
      }
    };
    mockEditor.chain = vi.fn().mockReturnValue({
      command: vi.fn().mockImplementation((fn: any) => {
        fn({ tr: mockTr, state: mockEditor.state });
        return { run: vi.fn() };
      })
    });

    const card: any = { titlePos: 10, title: "Old Title" };
    updateTaskContent(mockEditor, card, { title: "New Title" });

    expect(mockTr.insertText).toHaveBeenCalledWith("New Title", 11, 19);
    expect(mockEditor.chain).toHaveBeenCalled();
  });
});

describe("addTaskToStack", () => {
  it("should insert a new taskItem", () => {
    const mockTr: any = {
      insert: vi.fn(),
      mapping: { map: (p: number) => p },
    };
    const mockSchema: any = {
      nodes: {
        taskItem: { create: vi.fn().mockReturnValue({ nodeSize: 5 }) },
        paragraph: { create: vi.fn() },
        taskList: { create: vi.fn() },
      },
      text: vi.fn(),
    };
    const mockEditor: any = {
      state: {
        doc: {
          content: { size: 100 },
          nodesBetween: vi.fn(),
          resolve: vi.fn().mockReturnValue({ parent: { type: { name: "taskList" } } }),
          nodeAt: vi.fn(),
        },
        tr: mockTr,
        schema: mockSchema,
      }
    };
    mockEditor.chain = vi.fn().mockReturnValue({
      command: vi.fn().mockImplementation((fn: any) => {
        fn({ tr: mockTr, state: mockEditor.state });
        return { run: vi.fn() };
      })
    });

    const stack: any = { pos: 0, endPos: 100 };
    addTaskToStack(mockEditor, stack, { title: "New Task" });

    expect(mockTr.insert).toHaveBeenCalled();
    expect(mockEditor.chain).toHaveBeenCalled();
  });
});
