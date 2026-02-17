import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositories, useGlobalStore } from "../../store/global.store";
import { TagsGraph } from "../components/tags-graph";

export default function TagsPage() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [state] = useGlobalStore();
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [allNotes, allHashtags] = await Promise.all([
          repositories.notes.getAll(),
          repositories.hashtags.getAll(),
        ]);
        const nodes: any[] = [];
        const links: any[] = [];
        const tagSet = new Set<string>();
        const noteMap = new Map<string, string>(); // filename/path -> noteId
        allNotes.forEach((note) => {
          nodes.push({
            val: 5,
            id: note.id,
            type: "note",
            noteId: note.id,
            name: note.title || "Untitled",
          });
          if (note.filePath) noteMap.set(note.filePath, note.id);
          noteMap.set(note.title, note.id); // Fallback mapping
        });
        allHashtags.forEach((entry) => {
          if (!tagSet.has(entry.hashtag)) {
            nodes.push({
              id: `tag-${entry.hashtag}`,
              name: `#${entry.hashtag}`,
              type: "tag",
              val: 3,
            });
            tagSet.add(entry.hashtag);
          }
          const noteId = noteMap.get(entry.filename);
          if (noteId) {
            links.push({ source: noteId, target: `tag-${entry.hashtag}` });
          }
        });
        setGraphData({ nodes, links });
      } catch (error) {
        console.error("Failed to load graph data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [state.notes]);

  const handleNodeClick = (node: any) => {
    if (node.type === "note" && node.noteId) {
      navigate(`/note/${node.noteId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-full text-foreground">
        Loading graph...
      </div>
    );
  }

  return (
    <div className="w-full overflow-y-hidden h-full relative">
      <div className="absolute top-4 right-8 z-10 bg-card-background/80 backdrop-blur p-2 rounded border border-card-border">
        <h1 className="text-lg font-bold">Tags Graph</h1>
        <p className="text-xs text-foreground/70">
          {graphData.nodes.filter((n) => n.type === "note").length} notes,
          {graphData.nodes.filter((n) => n.type === "tag").length} tags
        </p>
      </div>
      <TagsGraph
        nodes={graphData.nodes}
        links={graphData.links}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
