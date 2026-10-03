import { Bell, CalendarPlus, Download, Plus, SlidersHorizontal, Users } from "lucide-react";
import { useState } from "react";
import { APPS, Button, Footer, Header, ICON_STROKE, IconButton, Pill, Reading, Segmented, Toolbar, ToolbarDivider, type Theme } from "../src/index.ts";

const DAVE = { name: "Dave", color: "#4c8bf5" };
const PEOPLE = [
  { name: "Dave", color: "#4c8bf5" },
  { name: "Julia", color: "#e05a3f" },
  { name: "Izzy", color: "#2fae66" },
  { name: "Ben", color: "#9b6bd1" },
];

type View = "month" | "week" | "agenda";

function Island({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div className="pv-island" data-cw-theme={theme}>
      {children}
    </div>
  );
}

function Specimens({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) {
  const [view, setView] = useState<View>("month");
  const [person, setPerson] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(true);
  const hostname = "localhost";

  return (
    <>
      <h2>Header — a workspace app, with page actions and a signed-in member</h2>
      <Header
        app="calendar"
        hostname={hostname}
        account={DAVE}
        theme={{ value: theme, onChange: onTheme }}
        settingsHref="#settings"
        logout={{ formAction: "#logout" }}
        actions={
          <>
            <IconButton label="Meetups">
              <Users size={18} strokeWidth={ICON_STROKE} />
            </IconButton>
            <IconButton label="Export">
              <Download size={18} strokeWidth={ICON_STROKE} />
            </IconButton>
          </>
        }
      />
      <Toolbar
        end={
          <Button variant="primary" icon={<Plus size={18} strokeWidth={ICON_STROKE} />}>
            Add entry
          </Button>
        }
      >
        <Segmented<View>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week", disabled: true, title: "Coming later" },
            { value: "agenda", label: "Agenda", disabled: true, title: "Coming later" },
          ]}
        />
        <ToolbarDivider />
        <Button>Today</Button>
        <Button variant="ghost" icon={<SlidersHorizontal size={18} strokeWidth={ICON_STROKE} />}>
          Filter
        </Button>
      </Toolbar>
      <p className="pv-note" style={{ paddingTop: 12 }}>
        Open the app name for the switcher and the avatar for the account menu.
      </p>

      <h2>Header — a reading app with no household identity yet</h2>
      <Header
        app="trains"
        hostname={hostname}
        account={null}
        theme={{ value: theme, onChange: onTheme }}
        actions={
          <IconButton label="Disruption alerts" active={alerts} onClick={() => setAlerts((on) => !on)}>
            <Bell size={18} strokeWidth={ICON_STROKE} />
          </IconButton>
        }
      />

      <h2>Header — the hub</h2>
      <Header app={null} hostname={hostname} />

      <h2>Buttons</h2>
      <div className="pv-row">
        <Button variant="primary" icon={<CalendarPlus size={18} strokeWidth={ICON_STROKE} />}>
          Add entry
        </Button>
        <Button variant="primary">Save</Button>
        <Button>Today</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <IconButton label="Alerts">
          <Bell size={18} strokeWidth={ICON_STROKE} />
        </IconButton>
        <IconButton label="Alerts on" active>
          <Bell size={18} strokeWidth={ICON_STROKE} />
        </IconButton>
      </div>

      <h2>Filter pills</h2>
      <div className="pv-row">
        <Pill active={person === null} onClick={() => setPerson(null)}>
          Everyone
        </Pill>
        {PEOPLE.map((member) => (
          <Pill key={member.name} dot={member.color} active={person === member.name} onClick={() => setPerson(member.name)}>
            {member.name}
          </Pill>
        ))}
      </div>

      <h2>Segmented control</h2>
      <div className="pv-row">
        <Segmented label="Station" value="fleet" onChange={() => {}} options={[{ value: "fleet", label: "Fleet" }, { value: "waterloo", label: "Waterloo" }]} />
        <Segmented label="Theme" size="sm" value={theme} onChange={onTheme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "auto", label: "Auto" }]} />
      </div>

      <h2>Surfaces and accents</h2>
      <div className="pv-stack">
        <div className="pv-card">
          <b>Saturday 3 October</b>
          Nothing on the board for <span className="pv-today">today</span>. Brand terracotta marks today and the primary action; nothing else.
        </div>
      </div>
      <div className="pv-swatches">
        {APPS.map((app) => (
          <div className="pv-swatch" key={app.key}>
            <i style={{ background: app.accent }} />
            <span>{app.name}</span>
          </div>
        ))}
      </div>

      <h2>Footer</h2>
      <Reading>
        <Footer />
      </Reading>
    </>
  );
}

export function Preview() {
  const [theme, setTheme] = useState<Theme>("light");
  const embed = new URLSearchParams(location.search).get("embed");

  if (embed === "light" || embed === "dark") {
    return (
      <div className="pv-embed" data-cw-theme={embed}>
        <Specimens theme={theme} onTheme={setTheme} />
      </div>
    );
  }

  return (
    <>
      <div className="pv-top">
        <div>
          <h1>Cornerways shell</h1>
          <p>Every shared component, light and dark, plus a 390px frame. Headers are unpinned here so both columns scroll together.</p>
        </div>
      </div>
      <div className="pv-grid">
        <Island theme="light">
          <Specimens theme={theme} onTheme={setTheme} />
        </Island>
        <Island theme="dark">
          <Specimens theme={theme} onTheme={setTheme} />
        </Island>
        <div>
          <iframe className="pv-phone" title="390px wide" src="?embed=light" />
        </div>
        <div>
          <iframe className="pv-phone" title="390px wide, dark" src="?embed=dark" />
        </div>
      </div>
    </>
  );
}
