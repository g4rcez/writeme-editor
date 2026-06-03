---
title: Input
description: Text input with optional masking for currencies, percentages, phone numbers, dates, and custom regex patterns.
package: "@g4rcez/components"
export: "{ Input }"
import: "import { Input } from '@g4rcez/components/input'"
category: form
---

# Input

Text input with optional masking for currencies, percentages, phone numbers, dates, and custom regex patterns.

## Import

```tsx
import { Input } from "@g4rcez/components/input";
```

## Props

`Input` extends all standard HTML `<input>` attributes plus `InputField` layout props:

| Prop             | Type                                                                   | Default | Description                                                                      |
| ---------------- | ---------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `mask`           | `AllMasks \| Array<string \| RegExp> \| ((value: string) => AllMasks)` | -       | Input mask pattern                                                               |
| `locale`         | `Locales`                                                              | -       | Locale for currency/number formatting                                            |
| `currency`       | `CurrencyCode`                                                         | -       | Currency code when using `mask="currency"`                                       |
| `error`          | `string`                                                               | -       | Error message shown below the field                                              |
| `title`          | `string`                                                               | -       | Field label                                                                      |
| `feedback`       | `Label`                                                                | -       | Success or neutral feedback text below the field                                 |
| `left`           | `Label`                                                                | -       | Content rendered on the left inside the field border                             |
| `right`          | `Label`                                                                | -       | Content rendered on the right inside the field border                            |
| `required`       | `boolean`                                                              | `false` | Marks field as required; hides "Optional" label text                             |
| `disabled`       | `boolean`                                                              | `false` | Disabled state                                                                   |
| `loading`        | `boolean`                                                              | `false` | Loading state                                                                    |
| `container`      | `string`                                                               | -       | Extra CSS classes for the outer `fieldset`                                       |
| `labelClassName` | `string`                                                               | -       | Extra CSS classes for the label/border wrapper                                   |
| `next`           | `string`                                                               | -       | `id` of the next field to focus when Enter is pressed with `enterKeyHint="next"` |
| `hiddenLabel`    | `boolean`                                                              | `false` | Visually hides the label but keeps it for screen readers                         |
| `...props`       | `React.InputHTMLAttributes<HTMLInputElement>`                          | -       | All standard input attributes                                                    |

### Mask patterns

| Pattern char | Matches           |
| ------------ | ----------------- |
| `9`          | Digit (0–9)       |
| `A`          | Letter (a–z, A–Z) |
| `S`          | Alphanumeric      |
| `*`          | Any character     |

### Special mask strings

| Value          | Description                                            |
| -------------- | ------------------------------------------------------ |
| `"currency"`   | Currency formatting (requires `locale` and `currency`) |
| `"percentage"` | Percentage input with `%` symbol                       |
| `"decimal"`    | Decimal number formatting                              |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                          | CSS Variable         | Purpose                                          |
| ------------------------------ | -------------------- | ------------------------------------------------ |
| `h-input-height`               | `--input-height`     | Input height                                     |
| `px-input-padding-x`           | `--input-padding-x`  | Horizontal padding                               |
| `py-input-padding-y`           | `--input-padding-y`  | Vertical padding                                 |
| `mt-input-gap`                 | `--input-gap`        | Gap between field border and error/feedback text |
| `border-input-border`          | `--input-border`     | Default border color                             |
| `text-input-label-text`        | `--input-label-text` | Label text color                                 |
| `text-foreground`              | `--foreground`       | Input text color                                 |
| `text-primary`                 | `--primary`          | Focus ring, focus/hover border color             |
| `text-danger`                  | `--danger`           | Error state border, text, and label color        |
| `text-disabled`                | `--disabled`         | Disabled text and border color                   |
| `placeholder-input-mask`       | `--input-mask`       | Placeholder text color                           |
| `placeholder-input-mask-error` | `--input-mask-error` | Placeholder color in error state                 |

## Examples

### Basic text input

```tsx
import { Input } from "@g4rcez/components/input";

<Input name="name" title="Full name" placeholder="Jane Smith" required />;
```

### Phone number mask

```tsx
<Input name="phone" title="Phone" mask="(99) 99999-9999" placeholder="(00) 00000-0000" />
```

### Currency input

```tsx
<Input name="price" title="Price" mask="currency" currency="USD" locale="en-US" placeholder="0.00" />
```

### Dynamic mask (CPF / CNPJ)

```tsx
const docMask = (value: string) => (value.replace(/\D/g, "").length <= 11 ? "999.999.999-99" : "99.999.999/9999-99");

<Input name="document" title="CPF or CNPJ" mask={docMask} placeholder="000.000.000-00" />;
```

### Input with inline left/right slots

```tsx
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

<Input name="search" title="Search" left={<MagnifyingGlassIcon size={16} className="text-muted-foreground" />} placeholder="Type to search..." />;
```

### Input with error and feedback

```tsx
const [email, setEmail] = useState("");
const error = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Enter a valid email address" : undefined;

<Input
    name="email"
    type="email"
    title="Email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    error={error}
    feedback={!error && email ? "Looks good!" : undefined}
/>;
```

### Enter-to-advance between fields

```tsx
<Input
  name="first"
  title="First name"
  enterKeyHint="next"
  next="last"
/>
<Input
  name="last"
  id="last"
  title="Last name"
  enterKeyHint="done"
/>
```

### Inside a form

```tsx
import { Form } from "@g4rcez/components/form";
import { Button } from "@g4rcez/components/button";

function SignUpForm() {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        const data = new FormData(e.currentTarget);
        console.log(Object.fromEntries(data));
    };

    return (
        <Form onSubmit={handleSubmit} className="flex flex-col gap-base max-w-md">
            <Input name="name" title="Full name" required />
            <Input name="email" type="email" title="Email" required />
            <Input name="phone" title="Phone" mask="(99) 99999-9999" />
            <Button theme="primary" type="submit">
                Sign up
            </Button>
        </Form>
    );
}
```

## Do

- Use `mask` patterns that match user expectations for the data type.
- Provide a `placeholder` that shows the expected format (e.g., `"(00) 00000-0000"`).
- Use the `error` prop to surface validation messages from your form library or manual validation.
- Use the `next` prop with `enterKeyHint="next"` to create smooth keyboard flows on mobile.
- Use design-token classes for wrapper elements (`bg-background`, `text-foreground`, `border-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use a mask that blocks valid input variations — prefer dynamic masks for formats with variable length.
- Don't forget that the mask formats the display value; if your backend expects raw data, strip formatting before sending.
- Don't use `Input` for long-form text — use `Textarea` instead.

## Accessibility

- Renders a semantic `<input>` wrapped in a `<fieldset>` with an associated `<label>` (via `InputField`).
- `aria-disabled`, `aria-readonly`, and `aria-busy` are set automatically from props.
- Error messages appear as a visible `<p>` below the field after the user has interacted with it (`data-initialized="true"`).
- Focus ring uses `focus:ring-primary` for consistent, visible keyboard indication.
- The `hiddenLabel` prop keeps the label in the accessibility tree while hiding it visually.

## Data Attributes

- `data-initialized` — managed by `initializeInputDataset`; switches from `"false"` to `"true"` after first user interaction, enabling validation display.
- `data-next` — set from the `next` prop; used to focus the next field on Enter.
- `data-component="input"` — set on the outer `fieldset` by `InputField`.
- `data-error` — on the `fieldset`: `"true"` when an `error` string is present.

## Notes

- Built on top of `the-mask-input`. All mask features from that library are available.
- The component automatically manages cursor positioning during masked input.
- Works with both controlled (`value` + `onChange`) and uncontrolled (`defaultValue`) patterns.
- `Input` is created via the `createFreeText` factory, which also powers `Textarea`. Both share the same styling tokens.
