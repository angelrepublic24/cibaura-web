export function SettingsPageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="settings-page-title">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

export function SettingsEditorRow({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-editor-row">
      <div className="settings-row-label">
        <span className="settings-section-number">{number}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}
