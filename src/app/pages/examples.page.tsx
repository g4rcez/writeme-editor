import { Link } from "brouther";
import { links } from "../router";

const examples = [
  {
    title: ">>math",
    href: links.mathExample,
    description: "A simple way to solve math expressions on the fly.",
  },
];

export default function AboutPage() {
  return (
    <ul className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {examples.map((example) => (
        <li key={example.title}>
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
