---
title: FileUpload
description: Drag-and-drop file upload area with file preview, modal viewer, and per-file deletion.
package: "@g4rcez/components"
export: "{ FileUpload }"
import: "import { FileUpload } from '@g4rcez/components/file-upload'"
category: form
---

# FileUpload

Drag-and-drop file upload area with file preview, modal viewer, and per-file deletion.

## Import

```tsx
import { FileUpload } from "@g4rcez/components/file-upload";
```

## Props

| Prop               | Type                                 | Default         | Description                                                          |
| ------------------ | ------------------------------------ | --------------- | -------------------------------------------------------------------- |
| `files`            | `File[]`                             | -               | Controlled files array                                               |
| `onDrop`           | `(files: File[]) => void`            | -               | Called when files are dropped or selected                            |
| `onDeleteFile`     | `(file: File) => void`               | -               | Called when the delete button on a file item is clicked              |
| `idle`             | `React.ReactElement`                 | Default idle UI | Content to show when no files are present and the area is not active |
| `File`             | `React.FC<{ file: File }>`           | -               | Custom component rendered below each file's name/size row            |
| `accept`           | `string \| Record<string, string[]>` | -               | Accepted file types (forwarded to `react-dropzone`)                  |
| `multiple`         | `boolean`                            | `false`         | Allow selecting more than one file                                   |
| `maxFiles`         | `number`                             | -               | Maximum number of files                                              |
| `maxSize`          | `number`                             | -               | Maximum file size in bytes                                           |
| `disabled`         | `boolean`                            | `false`         | Disable the drop zone                                                |
| `name`             | `string`                             | -               | Name for the underlying `<input>`                                    |
| `...DropzoneProps` |                                      |                 | All `react-dropzone` props are supported                             |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                | CSS Variable        | Purpose                                                         |
| -------------------- | ------------------- | --------------------------------------------------------------- |
| `border-card-border` | `--card-border`     | Border between file list items and default drop zone border     |
| `bg-card-background` | `--card-background` | Drop zone background when files are present                     |
| `text-foreground`    | `--foreground`      | General text color                                              |
| `text-primary`       | `--primary`         | Folder icon color and "browse" link color in default idle state |
| `text-danger`        | `--danger`          | Delete button hover color                                       |

## Drag and Drop States

| State         | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| Idle (empty)  | Displays the `idle` prop or the default folder icon with an upload prompt  |
| Drag active   | Replaces the idle UI with an open folder icon while dragging               |
| Files present | Renders the file list; drop zone border becomes solid and background fills |

## File Type Rendering

The component automatically selects an icon based on file extension:

| Extension(s)   | Icon                     |
| -------------- | ------------------------ |
| csv, xls, xlsx | `SheetIcon`              |
| pdf, txt       | `FileTextIcon`           |
| json           | `FileJsonIcon`           |
| mp3            | `AudioLinesIcon`         |
| mp4, mov       | `FileVideo2`             |
| Images         | Inline `<img>` thumbnail |
| Other          | Generic `FileIcon`       |

Clicking a file thumbnail opens a `Modal` viewer with full-size preview for images, `<video>` player for videos, and `<audio>` player for audio files.

## Examples

### Controlled image upload

```tsx
import { FileUpload } from "@g4rcez/components/file-upload";

function ImageUpload() {
    const [images, setImages] = useState<File[]>([]);

    return (
        <FileUpload
            files={images}
            onDrop={(added) => setImages((prev) => [...prev, ...added])}
            onDeleteFile={(file) => setImages((prev) => prev.filter((f) => f !== file))}
            accept="image/*"
            multiple
            maxFiles={10}
            maxSize={5 * 1024 * 1024}
        />
    );
}
```

### Single file upload

```tsx
function AvatarUpload() {
    const [file, setFile] = useState<File | null>(null);

    return (
        <FileUpload
            files={file ? [file] : []}
            onDrop={(files) => setFile(files[0])}
            onDeleteFile={() => setFile(null)}
            accept="image/jpeg,image/png"
            multiple={false}
            maxSize={2 * 1024 * 1024}
        />
    );
}
```

### Custom idle state

```tsx
import { UploadSimpleIcon } from "@phosphor-icons/react";

const CustomIdle = () => (
    <div className="flex flex-col items-center gap-2 py-10">
        <UploadSimpleIcon size={48} className="text-primary" />
        <p className="text-foreground font-medium">Drop files here</p>
        <p className="text-muted-foreground text-sm">PDF, DOCX, up to 10 MB each</p>
    </div>
);

<FileUpload files={[]} onDrop={setFiles} idle={<CustomIdle />} accept="application/pdf,.docx" multiple />;
```

### Custom per-file renderer

```tsx
const ProgressRow = ({ file }: { file: File }) => {
    const progress = useUploadProgress(file);
    return (
        <div className="flex flex-col gap-1 pb-2">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress < 100 ? "Uploading..." : "Done"}</span>
                <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
};

<FileUpload files={files} onDrop={setFiles} File={ProgressRow} multiple />;
```

### Inside a form

```tsx
import { Form } from "@g4rcez/components/form";
import { Button } from "@g4rcez/components/button";

function SubmissionForm() {
    const [attachments, setAttachments] = useState<File[]>([]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        const data = new FormData(e.currentTarget);
        attachments.forEach((f) => data.append("attachments", f));
        submitToServer(data);
    };

    return (
        <Form onSubmit={handleSubmit} className="flex flex-col gap-base">
            <FileUpload
                name="attachments"
                files={attachments}
                onDrop={(added) => setAttachments((prev) => [...prev, ...added])}
                onDeleteFile={(f) => setAttachments((prev) => prev.filter((x) => x !== f))}
                accept="image/*,.pdf"
                multiple
                maxSize={10 * 1024 * 1024}
            />
            <Button theme="primary" type="submit">
                Submit
            </Button>
        </Form>
    );
}
```

## Do

- Always set `accept` to restrict uploads to the file types your server expects.
- Set `maxSize` to provide immediate client-side feedback for oversized files.
- Use `multiple` when batch uploads are expected.
- Use the `File` prop to add progress bars, metadata, or custom actions below each file row.
- Use design-token classes for wrapper elements (`bg-card-background`, `text-foreground`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't rely solely on client-side `maxSize`/`accept` — validate files server-side as well.
- Don't skip `onDeleteFile` when `files` is controlled — without it, users cannot remove files they added.

## Accessibility

- The drop zone uses `react-dropzone`'s `getRootProps` and `getInputProps`, which include keyboard support (Enter/Space to open the file browser).
- The hidden `<input type="file">` is accessible by assistive technologies.
- Delete buttons include a `type="button"` to prevent accidental form submission.
- The modal viewer opened for file preview is managed by the `Modal` component, which handles focus trapping and Escape to close.

## Data Attributes

- `data-active="true"` — on the drop zone wrapper when at least one file is present; used to switch between dashed (empty) and solid (filled) border styles.

## Notes

- When `files` is not provided, the component manages its own internal file state. Pass `files` for fully controlled behavior.
- Object URLs created for previews are revoked on cleanup via `useEffect` to prevent memory leaks.
- The `File` prop (custom renderer) is rendered inside the file list item, below the file name and size row, alongside the built-in delete button.
- The component depends on `react-dropzone` and `pretty-bytes` as peer dependencies.
