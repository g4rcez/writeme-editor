import { useLayoutContext } from "@/app/contexts/layout-context";
import { repositories } from "@/store/repositories";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { useEffect, useState } from "react";

export const TagsPane = () => {
  const { state, dispatch } = useLayoutContext();
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTags = async () => {
      setLoading(true);
      try {
        const allHashtags = await repositories.hashtags.getAll();
        const tagCounts = new Map<string, number>();
        allHashtags.forEach((h) => {
          tagCounts.set(h.hashtag, (tagCounts.get(h.hashtag) || 0) + 1);
        });
        const sortedTags = Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count);
        setTags(sortedTags);
      } catch (error) {
        console.error("Failed to load tags:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTags();
  }, []);

  const onTagClick = (tag: string) =>
    dispatch({ type: "SET_VIEW", view: { type: "tag", id: tag } });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full text-sm text-muted-foreground">
        Loading tags...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          Tags
        </span>
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {tags.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-sm text-muted-foreground">
            No tags found
          </div>
        ) : (
          <div className="space-y-0.5">
            {tags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${state.activeView.type === "tag" && state.activeView.id === tag
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/50 hover:text-foreground"
                  }`}
              >
                <HashIcon className="opacity-60 size-3.5" />
                <span className="flex-1 text-left truncate">{tag}</span>
                <span className="flex justify-center items-center rounded-full transition-colors duration-300 ease-linear size-5 aspect-square text-[10px] bg-muted group-hover:bg-primary">
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
