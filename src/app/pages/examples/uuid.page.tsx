import { Editor } from "../../editor";

const content = `# >>uuid
You can generate unique identifiers using the \`>>uuid\` command.

The UUID (Universally Unique Identifier) command generates random UUIDs following the standard format.

## Usage Examples

Try typing any of these commands:

- \`>>uuid\` - Generates a standard UUID v4

## Example Output
\`550e8400-e29b-41d4-a716-446655440000\`

UUIDs are useful for:
- Creating unique identifiers for records
- Generating session tokens
- Creating temporary file names
- Database primary keys
`

export default function UuidPage() {
  return <Editor content={content} />;
}
