import { Box, Button, Card, Dialog, Stack, Text } from "@sanity/ui";
import { useCallback, useRef, useState } from "react";
import type { AssetFromSource, AssetSource, AssetSourceComponentProps } from "sanity";

import { prepareUpload, UPLOAD_LIMITS } from "../../src/lib/image-metadata";

/**
 * The only way an image can enter this dataset.
 *
 * `form.image.directUploads` is switched off in sanity.config.ts, which removes
 * Sanity's own drag-and-drop and paste handlers. That leaves this asset source
 * as the single entry point, so the checks below cannot be walked around by
 * dropping a file somewhere else in the Studio.
 *
 * Each file is sniffed by magic bytes, bounded by size and dimensions, and has
 * its metadata segments removed *before* upload — on Hattie's own machine, so a
 * photograph's GPS coordinates never leave it. The strip is byte-level surgery
 * on the container rather than a re-encode, so it costs single-digit
 * milliseconds on a 15 MB export and every pixel is preserved.
 *
 * Sanity still performs the upload itself, keeping its progress reporting,
 * retries, and resumable transfer — this only decides what it is handed.
 */
function CleanUpload(props: AssetSourceComponentProps) {
  const { onSelect, onClose, accept, selectionType } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      setBusy(true);
      setErrors([]);

      const rejected: string[] = [];
      const cleaned: AssetFromSource[] = [];

      for (const file of Array.from(fileList)) {
        const result = prepareUpload(new Uint8Array(await file.arrayBuffer()));

        if (!result.ok) {
          rejected.push(`${file.name} — ${result.reason}`);
          continue;
        }

        // Same name, same format, full resolution, no camera data.
        const scrubbed = new File([result.bytes as BlobPart], file.name, {
          type: `image/${result.format}`,
          lastModified: file.lastModified,
        });

        cleaned.push({
          kind: "file",
          // `AssetFromSource["value"]` is typed against Sanity's own `File`
          // schema type rather than the DOM File that a `kind: "file"` entry
          // actually requires at runtime. The cast is to work around that
          // collision in Sanity's types, not to bypass a real check.
          value: scrubbed as unknown as AssetFromSource["value"],
        });
      }

      setBusy(false);
      setErrors(rejected);

      if (cleaned.length) {
        onSelect(selectionType === "single" ? cleaned.slice(0, 1) : cleaned);
      }
    },
    [onSelect, selectionType],
  );

  return (
    <Dialog id="clean-upload" header="Add a photo" onClose={onClose} width={1}>
      <Box padding={4}>
        <Stack space={4}>
          <Card
            padding={5}
            radius={1}
            border
            tone={dragging ? "primary" : "transparent"}
            style={{ textAlign: "center", cursor: "pointer" }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handle(e.dataTransfer.files);
            }}
          >
            <Stack space={3}>
              <Text weight="medium">
                {busy ? "Checking your photos…" : "Drop photos here, or tap to choose"}
              </Text>
              <Text size={1} muted>
                JPEG, PNG, or WebP. Up to {UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB and{" "}
                {UPLOAD_LIMITS.maxDimension.toLocaleString()} pixels on a side. Full resolution is
                kept — camera data, including where the photo was taken, is removed first.
              </Text>
            </Stack>
          </Card>

          <input
            ref={inputRef}
            type="file"
            accept={accept || "image/jpeg,image/png,image/webp"}
            multiple={selectionType !== "single"}
            style={{ display: "none" }}
            onChange={(e) => void handle(e.currentTarget.files)}
          />

          {errors.length > 0 && (
            <Stack space={2}>
              {errors.map((message) => (
                <Card key={message} padding={3} radius={1} tone="critical" border>
                  <Text size={1}>{message}</Text>
                </Card>
              ))}
            </Stack>
          )}

          <Button mode="bleed" text="Cancel" onClick={onClose} />
        </Stack>
      </Box>
    </Dialog>
  );
}

export const cleanUploadSource: AssetSource = {
  name: "clean-upload",
  title: "Upload a photo",
  component: CleanUpload,
};
