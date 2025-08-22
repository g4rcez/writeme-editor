import { Link } from "brouther";
import { links } from "../router";

const examples = [
  {
    title: ">>math",
    href: links.mathExample,
    description: "A simple way to solve math expressions on the fly.",
  },
  {
    title: ">>uuid",
    href: links.uuidExample,
    description: "Generate unique identifiers with UUID v4 format.",
  },
  {
    title: ">>eval",
    href: links.evalExample,
    description: "Execute JavaScript code directly in your editor.",
  },
  {
    title: ">>latex",
    href: links.latexExample,
    description: "Render beautiful mathematical formulas using LaTeX.",
  },
  {
    title: ">>expr",
    href: links.exprExample,
    description: "Safely evaluate mathematical expressions and functions.",
  },
];

export default function AboutPage() {
  return (
    <ul className="grid grid-cols-1 gap-8 justify-start items-start w-full lg:grid-cols-3 h-fit">
      {examples.map((example) => (
        <li key={example.title} className="block">
          <Link
            href={example.href}
            className="flex flex-col gap-1 p-3 rounded-lg border transition-all duration-300 ease-linear hocus:text-primary hocus:border-primary bg-card-background border-card-border"
          >
            <h2 className="text-lg font-semibold">{example.title}</h2>
            <p className="text-secondary">{example.description}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
