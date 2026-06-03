---
title: Form
description: Thin wrapper around the HTML form element that calls preventDefault automatically before invoking onSubmit.
package: "@g4rcez/components"
export: "{ Form }"
import: "import { Form } from '@g4rcez/components/form'"
category: form
---

# Form

Thin wrapper around the HTML `<form>` element that calls `preventDefault` automatically before invoking `onSubmit`.

## Import

```tsx
import { Form } from "@g4rcez/components/form";
```

## Props

`Form` accepts all standard HTML `<form>` attributes.

| Prop        | Type                                                | Default | Description                                                            |
| ----------- | --------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `onSubmit`  | `(event: React.FormEvent<HTMLFormElement>) => void` | -       | Submit handler. `preventDefault()` is called before this.              |
| `children`  | `React.ReactNode`                                   | -       | Form fields and other content.                                         |
| `className` | `string`                                            | -       | CSS classes for the `<form>` element.                                  |
| `...props`  | `React.ComponentProps<"form">`                      | -       | All standard form attributes (`action`, `method`, `noValidate`, etc.). |

## Design Tokens

`Form` has no direct token usage. Tokens are applied by the child components (`Input`, `Button`, etc.) placed inside it.

## Examples

### Login form

```tsx
import { Form } from "@g4rcez/components/form";
import { Input } from "@g4rcez/components/input";
import { Button } from "@g4rcez/components/button";

function LoginForm() {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        const data = new FormData(e.currentTarget);
        console.log(Object.fromEntries(data));
    };

    return (
        <Form onSubmit={handleSubmit} className="flex flex-col gap-base max-w-sm">
            <Input name="email" type="email" title="Email" required />
            <Input name="password" type="password" title="Password" required />
            <Button theme="primary" type="submit">
                Log in
            </Button>
        </Form>
    );
}
```

### Reading FormData on submit

```tsx
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData);
    await fetch("/api/contact", { method: "POST", body: JSON.stringify(payload) });
};

<Form onSubmit={handleSubmit} className="flex flex-col gap-base">
    <Input name="name" title="Name" required />
    <Input name="message" title="Message" />
    <Button theme="primary" type="submit">
        Send
    </Button>
</Form>;
```

### Multi-column layout

```tsx
<Form className="grid grid-cols-2 gap-base max-w-2xl">
    <Input name="firstName" title="First name" required />
    <Input name="lastName" title="Last name" required />
    <Input name="email" type="email" title="Email" container="col-span-2" required />
    <Button type="submit" theme="primary" container="col-start-2">
        Save
    </Button>
</Form>
```

## Do

- Use `Form` instead of a raw `<form>` to avoid calling `e.preventDefault()` in every submit handler.
- Always include a `<Button type="submit">` or `<button type="submit">` so keyboard users can submit with Enter.
- Use design-token layout utilities (`gap-base`, `gap-sm`) for consistent spacing between fields.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) to `Form` — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block instead.
- Don't use `Form` when you need a traditional server-rendered full-page reload; use a plain `<form>` with `action` and `method` instead.

## Accessibility

- Renders a semantic `<form>` element, correctly identified by assistive technologies.
- Ensure every field inside the form has an associated label (the `Input`, `Select`, and other components in this library do this automatically via `InputField`).

## Notes

- `Form` is intentionally minimal — it has no state, no validation logic, and no styling. All field-level behavior is delegated to child components.
- The `e.persist()` call inside the wrapper ensures the synthetic event remains accessible in async submit handlers.
