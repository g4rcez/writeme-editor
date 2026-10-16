import type { ComponentProps, JSX } from "react";
import { FilePdfIcon } from "@phosphor-icons/react/dist/csr/FilePdf";
import Lightbox, { type RenderSlideProps, type SlideImage } from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import { PdfMediaSlide } from "./pdf-media-slide";
import "yet-another-react-lightbox/styles.css";

declare module "yet-another-react-lightbox" {
    interface SlideTypes {
        pdf: Omit<SlideImage, "type"> & { type: "pdf" };
    }
}

const PLUGINS = [Video, Zoom, Thumbnails, Fullscreen];
const PDF_PLUGINS = [Video, Thumbnails, Fullscreen];
type LightboxRender = NonNullable<ComponentProps<typeof Lightbox>["render"]>;
type ThumbnailRenderProps = Parameters<NonNullable<LightboxRender["thumbnail"]>>[0];

function renderPdfSlide({ slide }: RenderSlideProps): JSX.Element | null {
    if (slide.type !== "pdf") return null;
    return <PdfMediaSlide key={slide.src} src={slide.src} title={slide.alt ?? "PDF document"} />;
}

function renderPdfThumbnail({ slide }: ThumbnailRenderProps): JSX.Element | null {
    if (slide.type !== "pdf") return null;
    return (
        <span className="flex size-full items-center justify-center bg-secondary-background text-foreground">
            <FilePdfIcon aria-hidden="true" size={24} />
        </span>
    );
}

const PDF_RENDER = { slide: renderPdfSlide, thumbnail: renderPdfThumbnail };

export const MediaPreview = () => {
    const [ui] = useUIStore();
    if (!ui.mediaPreview.open) return null;
    const currentSource = ui.mediaPreview.sources[ui.mediaPreview.index];
    const slides = ui.mediaPreview.sources.map((source) => {
        if (source.type === "video") {
            return {
                type: "video" as const,
                sources: [{ src: source.src, type: "video/mp4" }],
            };
        }
        if (source.type === "pdf") {
            return { type: "pdf" as const, src: source.src, alt: source.title };
        }
        return { src: source.src, alt: source.title };
    });
    const plugins = currentSource?.type === "pdf" ? PDF_PLUGINS : PLUGINS;

    return (
        <Lightbox
            slides={slides}
            plugins={plugins}
            open={ui.mediaPreview.open}
            index={ui.mediaPreview.index}
            close={uiDispatch.closeMediaPreview}
            render={PDF_RENDER}
        />
    );
};
