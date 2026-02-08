import { Link } from "react-router-dom";

const examples = [
  {
    title: ">>math",
    to: "/examples/math",
    description: "A simple way to solve math expressions on the fly.",
  },
  {
    title: ">>uuid",
    to: "/examples/uuid",
    description: "Generate unique identifiers with UUID v4 format.",
  },
  {
    title: ">>eval",
    to: "/examples/eval",
    description: "Execute JavaScript code directly in your editor.",
  },
  {
    title: ">>latex",
    to: "/examples/latex",
    description: "Render beautiful mathematical formulas using LaTeX.",
  },
  {
    title: ">>expr",
    to: "/examples/expr",
    description: "Safely evaluate mathematical expressions and functions.",
  },
];

export default function AboutPage() {
  return (
    <ul className="grid grid-cols-1 gap-8 justify-start items-start w-full lg:grid-cols-3 h-fit">
      {examples.map((example) => (
        <li key={example.title} className="block">
          <Link
            to={example.to}
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