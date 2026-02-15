import { Card } from "@g4rcez/components";
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
    title: ">>expr",
    to: "/examples/expr",
    description: "Safely evaluate mathematical expressions and functions.",
  },
  {
    title: ">>money",
    to: "/examples/money",
    description: "Convert between different currencies in real-time.",
  },
  {
    title: ">>table",
    to: "/examples/table",
    description: "Quickly insert tables with custom row and column sizes.",
  },
  {
    title: ">>copy",
    to: "/examples/copy",
    description: "Automatically sync and paste your clipboard content.",
  },
];

export default function AboutPage() {
  return (
    <ul className="grid grid-cols-1 gap-8 justify-start items-start mx-auto w-full lg:grid-cols-3 max-w-safe h-fit">
      {examples.map((example) => (
        <li key={example.title}>
          <Link to={example.to}
            className="transition-all duration-300 ease-in group hover:text-primary"
          >
            <Card title={example.title} className="block">
              <p className="group-hover:underline">{example.description}</p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
