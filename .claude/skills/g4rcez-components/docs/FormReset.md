---
title: formReset
description: Utility function that resets all inputs and selects in a form to their default values and clears their initialization state.
package: "@g4rcez/components"
export: "{ formReset }"
import: "import { formReset } from '@g4rcez/components'"
category: form
---

# formReset

Utility function that resets all inputs and selects in a form to their default values and clears their initialization state.

## Import

```tsx
import { formReset } from "@g4rcez/components";
```

## Signature

```ts
function formReset(form?: HTMLFormElement | null): void;
```

## Parameters

| Parameter | Type                                   | Description                                                        |
| --------- | -------------------------------------- | ------------------------------------------------------------------ |
| `form`    | `HTMLFormElement \| null \| undefined` | The form element to reset. Safely no-ops if `null` or `undefined`. |

## How It Works

1. Iterates over all elements in the form (`form.elements`).
2. For `<input>` elements: sets `input.value` to `input.defaultValue`.
3. For `<select>` elements: sets `select.value` to `""`.
4. On every processed field: sets `data-initialized="false"`, which tells components like `Input` and `Autocomplete` to treat the field as untouched (suppressing validation messages).

## Examples

### Reset after successful submission

```tsx
import { useRef } from "react";
import { Form } from "@g4rcez/components/form";
import { Input } from "@g4rcez/components/input";
import { Button } from "@g4rcez/components/button";
import { formReset } from "@g4rcez/components";

function ContactForm() {
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        const data = new FormData(e.currentTarget);
        await submitToServer(Object.fromEntries(data));
        formReset(formRef.current);
    };

    return (
        <Form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-base">
            <Input name="name" title="Name" required />
            <Input name="email" type="email" title="Email" required />
            <Button theme="primary" type="submit">
                Send
            </Button>
        </Form>
    );
}
```

### Cancel button that resets the form

```tsx
function EditForm({ defaultValues }: { defaultValues: Record<string, string> }) {
    const formRef = useRef<HTMLFormElement>(null);

    return (
        <Form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-base">
            <Input name="title" title="Title" defaultValue={defaultValues.title} />
            <Input name="description" title="Description" defaultValue={defaultValues.description} />
            <div className="flex gap-sm">
                <Button theme="primary" type="submit">
                    Save
                </Button>
                <Button theme="ghost" type="button" onClick={() => formReset(formRef.current)}>
                    Cancel
                </Button>
            </div>
        </Form>
    );
}
```

## Do

- Use `formReset` (instead of `form.reset()`) when the form contains library components — it also resets the `data-initialized` flag that controls validation UI.
- Pass a valid `HTMLFormElement` ref.

## Don't

- Don't expect `formReset` to fire `onChange` events — it modifies `value` directly in the DOM without dispatching React synthetic events.
- Don't use `formReset` to reset a single field; use standard DOM methods or React state for that.
- Don't use `formReset` as a substitute for React-controlled state management in complex forms.

## Accessibility

No direct accessibility implications. After a reset, validation error messages will disappear because `data-initialized="false"` prevents them from being shown again until the user interacts with each field.

## Data Attributes

- Sets `data-initialized="false"` on every `INPUT` and `SELECT` element in the form. This attribute is read by `InputField` to decide whether to display validation feedback.

## Notes

- Safe to call with `null` or `undefined` — the function returns early without throwing.
- Only processes elements with `tagName === "INPUT"` or `tagName === "SELECT"`. `<textarea>` elements are not currently reset by this utility.
- This is a plain function, not a React component or hook. It works on DOM references directly.
