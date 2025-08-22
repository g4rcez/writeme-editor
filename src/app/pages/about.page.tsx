const Section = (props: { title: string; description: string }) => {
  return (
    <section className="flex flex-col gap-2 text-center">
      <h3 className="text-2xl font-semibold">{props.title}</h3>
      <p className="leading-loose text-center text-balance">
        {props.description}
      </p>
    </section>
  );
};

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-4xl font-bold">About this project</h2>
        <p className="my-4 font-medium leading-loose text-pretty">
          A distraction-free writing environment that respects your privacy and
          keeps things beautifully simple.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Section
          title="Simplicity"
          description="No accounts, no menus, no distractions. Just open and start writing. The clean interface keeps your focus on what matters most—your words."
        />
        <Section
          title="Markdown"
          description="Write in plain text with Markdown support. Headers, lists, and links format automatically as you type. Switch between raw text and preview instantly."
        />
        <Section
          title="Privacy first"
          description="Your writing never leaves your device. Everything saves locally in your browser—no servers, no tracking, no data collection. Just you and your words."
        />
      </div>
    </div>
  );
}
