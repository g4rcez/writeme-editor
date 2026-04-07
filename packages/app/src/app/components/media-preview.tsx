import { uiDispatch, useUIStore } from "@/store/ui.store";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

const PLUGINS = [Video, Zoom, Thumbnails, Fullscreen];

export const MediaPreview = () => {
  const [ui] = useUIStore();
  if (!ui.mediaPreview.open) return null;
  const slides = ui.mediaPreview.sources.map((source) => {
    if (source.type === "video") {
      return {
        type: "video" as const,
        sources: [{ src: source.src, type: "video/mp4" }],
      };
    }
    return { src: source.src, alt: source.title };
  });

  return (
    <Lightbox
      slides={slides}
      plugins={PLUGINS}
      open={ui.mediaPreview.open}
      index={ui.mediaPreview.index}
      close={uiDispatch.closeMediaPreview}
    />
  );
};
