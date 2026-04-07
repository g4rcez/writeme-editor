# Code Runner

The Coderunner feature allows you to execute code snippets directly within your notes. It uses Electron IPC to spawn a child process on your operating system, piping your code to STDIN and capturing STDOUT and STDERR.

## How it works

1. Create a code block with a supported language.
2. If the language is supported and the compiler/runner is installed on your system, a **Run** button will appear in the code block header.
3. Click **Run** to execute the code.
4. The output will be displayed below the code block, with ANSI colors and symbols supported (best viewed with a Nerd Font).

## Supported Languages

The editor currently supports the following execution environments:

| Language | Compiler/Runner | Command |
| --- | --- | --- |
| JavaScript | Node.js | `node` |
| TypeScript | ts-node | `ts-node` |
| Python | Python 3 | `python3` |
| Ruby | Ruby | `ruby` |
| Go | Go | `go run` |
| Rust | Rust Script | `rust-script` |
| Bash | Bash | `bash` |
| Shell | Shell | `sh` |
| Zsh | Zsh | `zsh` |

## Try it out!

Below is a JavaScript code block. If you have Node.js installed, you can run it right now:

```javascript
const message = "Hello from the Writeme Coderunner!";
console.log(message);
console.log("Current Node version:", process.version);
```

And here is a Bash example:

```bash
echo "Current directory: $(pwd)"
echo "Listing files:"
ls -F
```