import { Input, Select } from "@g4rcez/components";
import { useState } from "react";
import { TRANSCRIPTION_MODELS } from "@/lib/meeting-models";

export function MeetingModelSelect({
    model,
    onChange,
    models = TRANSCRIPTION_MODELS,
}: {
    model: string;
    onChange: (model: string) => void;
    models?: { label: string; value: string }[];
}): React.JSX.Element {
    const [custom, setCustom] = useState(false);
    const preset = !custom && models.some(({ value }) => value === model) ? model : "custom";
    return (
        <>
            <Select
                title="Transcription model"
                value={preset}
                options={[...models, { label: "Custom model", value: "custom" }]}
                onChange={(event) => {
                    const value = event.target.value;
                    setCustom(value === "custom");
                    if (value !== "custom") onChange(value);
                }}
            />
            {preset === "custom" ? (
                <Input
                    title="Custom model ID"
                    value={model}
                    maxLength={200}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Model ID accepted by your server"
                />
            ) : null}
        </>
    );
}
