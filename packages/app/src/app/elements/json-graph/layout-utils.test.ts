import { describe, it, expect, vi } from "vitest";
import { transformJsonToGraph } from "./layout-utils";

describe("transformJsonToGraph", () => {
  it("transforms a simple object correctly", () => {
    const json = { name: "test", version: 1 };
    const expandedPaths = new Set(["$"]);
    const onToggle = vi.fn();
    const onValueChange = vi.fn();
    
    const { nodes, edges } = transformJsonToGraph(json, expandedPaths, onToggle, onValueChange);
    
    expect(nodes).toHaveLength(3); // $, $.name, $.version
    expect(edges).toHaveLength(2); // $->$.name, $->$.version
    
    const rootNode = nodes.find(n => n.id === "$");
    expect(rootNode?.data.type).toBe("object");
    
    const nameNode = nodes.find(n => n.id === "$.name");
    expect(nameNode?.data.label).toBe("name");
    expect(nameNode?.data.value).toBe("test");
  });

  it("handles arrays correctly", () => {
    const json = [1, 2];
    const expandedPaths = new Set(["$"]);
    const onToggle = vi.fn();
    const onValueChange = vi.fn();
    
    const { nodes, edges } = transformJsonToGraph(json, expandedPaths, onToggle, onValueChange);
    
    expect(nodes).toHaveLength(3); // $, $[0], $[1]
    expect(edges).toHaveLength(2);
    
    const rootNode = nodes.find(n => n.id === "$");
    expect(rootNode?.data.type).toBe("array");
  });

  it("filters nodes and highlights path based on search query", () => {
    const json = { foo: { bar: "target" }, baz: "qux" };
    const expandedPaths = new Set(["$"]);
    const onToggle = vi.fn();
    const onValueChange = vi.fn();
    
    const { nodes, edges } = transformJsonToGraph(json, expandedPaths, onToggle, onValueChange, "target");
    
    const targetNode = nodes.find(n => n.id === "$.foo.bar");
    const fooNode = nodes.find(n => n.id === "$.foo");
    const bazNode = nodes.find(n => n.id === "$.baz");
    
    expect(targetNode?.data.matchesSearch).toBe(true);
    expect(targetNode?.data.isPathToMatch).toBe(true);
    
    expect(fooNode?.data.matchesSearch).toBe(false);
    expect(fooNode?.data.isPathToMatch).toBe(true); // Parent of match
    
    expect(bazNode).toBeUndefined(); // Not on path and not expanded
  });
});
