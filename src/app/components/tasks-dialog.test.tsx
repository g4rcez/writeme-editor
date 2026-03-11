import { describe, it, expect } from "vitest";
import { parseEditorTasks } from "./tasks-dialog";

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
          forEach: (f: any) => f({ type: { name: "paragraph" }, textContent: "Task 1" }) 
        }, 11);
        
        // ## H2
        cb({ type: { name: "heading" }, attrs: { level: 2 }, textContent: "H2 title" }, 20);
        // - [x] Task 2
        cb({ type: { name: "taskList" } }, 30);
        cb({ 
          type: { name: "taskItem" }, 
          attrs: { checked: true }, 
          nodeSize: 5, 
          forEach: (f: any) => f({ type: { name: "paragraph" }, textContent: "Task 2" }) 
        }, 31);
      }
    };

    const stacks = parseEditorTasks(mockDoc);
    
    expect(stacks).toHaveLength(2);
    expect(stacks[0].title).toBe("H1 title");
    expect(stacks[0].cards).toHaveLength(1);
    expect(stacks[0].cards[0].title).toBe("Task 1");
    expect(stacks[0].cards[0].checked).toBe(false);

    expect(stacks[1].title).toBe("H2 title");
    expect(stacks[1].cards).toHaveLength(1);
    expect(stacks[1].cards[0].title).toBe("Task 2");
    expect(stacks[1].cards[0].checked).toBe(true);
  });

  it("should group tasks under a default stack if no heading is present", () => {
    const mockDoc: any = {
      content: { size: 100 },
      descendants: (cb: any) => {
        cb({ type: { name: "taskList" } }, 0);
        cb({ 
          type: { name: "taskItem" }, 
          attrs: { checked: false }, 
          nodeSize: 5, 
          forEach: (f: any) => f({ type: { name: "paragraph" }, textContent: "Task 1" }) 
        }, 1);
      }
    };

    const stacks = parseEditorTasks(mockDoc);
    
    expect(stacks).toHaveLength(1);
    expect(stacks[0].title).toBe("Tasks");
    expect(stacks[0].cards).toHaveLength(1);
    expect(stacks[0].cards[0].title).toBe("Task 1");
  });

  it("should calculate endPos for stacks and cards", () => {
    const mockDoc: any = {
      content: { size: 100 },
      descendants: (cb: any) => {
        cb({ type: { name: "heading" }, attrs: { level: 2 }, textContent: "H2" }, 10);
        cb({ type: { name: "taskList" } }, 20);
        cb({ 
          type: { name: "taskItem" }, 
          attrs: { checked: false }, 
          nodeSize: 10, 
          forEach: (f: any) => f({ type: { name: "paragraph" }, textContent: "T1" }) 
        }, 21);
        cb({ type: { name: "heading" }, attrs: { level: 2 }, textContent: "H2-2" }, 50);
      }
    };

    const stacks = parseEditorTasks(mockDoc);
    
    expect(stacks).toHaveLength(2);
    expect(stacks[0].pos).toBe(10);
    expect(stacks[0].endPos).toBe(50);
    expect(stacks[0].cards[0].pos).toBe(21);
    expect(stacks[0].cards[0].endPos).toBe(31); // 21 + 10

    expect(stacks[1].pos).toBe(50);
    expect(stacks[1].endPos).toBe(100);
  });
});
