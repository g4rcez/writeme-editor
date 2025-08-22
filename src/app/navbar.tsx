import { Link } from "brouther";
import { links } from "./router";

export const Navbar = () => {
  return (
    <header className="sticky top-0 w-full h-12 bg-card-background">
      <nav className="container flex justify-between items-center px-8 mx-auto w-full max-w-5xl h-12 lg:px-0">
        <h1>
          <Link href={links.root}>writeme</Link>
        </h1>
        <ul className="flex flex-row gap-8 items-center">
          <li>
            <Link href={links.examples}>examples</Link>
          </li>
          <li>
            <Link href={links.about}>about</Link>
          </li>
          <li>help</li>
        </ul>
      </nav>
    </header>
  );
};
