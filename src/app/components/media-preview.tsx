import { uiDispatch, useUIStore } from "@/store/ui.store";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

export const MediaPreview = () => {
  const { mediaPreview } = useUIStore();

  if (!mediaPreview.open) return null;

  const slides = mediaPreview.sources.map((source) => {
    if (source.type === "video") {
      return {
        type: "video" as const,
        sources: [
          {
            src: source.src,
            type: "video/mp4", // Default to mp4, could be improved
          },
        ],
      };
    }
    if (source.type === "pdf") {
      return {
        type: "custom" as const,
        src: source.src,
      };
    }
    return {
      src: source.src,
      alt: source.title,
    };
  });

  return (
    <Lightbox
      open={mediaPreview.open}
      close={() => uiDispatch.closeMediaPreview()}
      index={mediaPreview.index}
      slides={slides}
      plugins={[Video, Zoom, Thumbnails, Fullscreen]}
      render={{
        slide: ({ slide }: { slide: any }) => {
          if (slide.type === "custom") {
            return (
              <div className="w-full h-full flex items-center justify-center p-4">
                <iframe
                  src={slide.src}
                  className="w-full h-full border-none bg-white rounded-lg shadow-lg"
                  title="PDF Preview"
                />
              </div>
            );
          }
          return undefined; // use default renderer
        },
      }}
    />
  );
};
