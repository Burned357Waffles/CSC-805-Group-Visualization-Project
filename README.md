COVID-19 Vaccination, Outcomes & Hesitancy — Interactive Dashboard

An interactive, client-side data visualization system exploring the relationship between COVID-19 vaccination rates, cases/deaths, and vaccine hesitancy in the United States. The app supports national context, single-state deep dives, multi-state comparisons, and hesitancy vs. uptake views with interactive time brushing, state selection, lag adjustments, and explanatory event markers.

Status: Overview page implemented with mock data; real cleaned datasets will be embedded (no external fetch). Additional pages (“State Profile”, “Compare States”, “Hesitancy vs Uptake”) will reuse the same store and UI primitives.

✨ Features (Overview page)

Global Nav with page tabs + “Reset all filters”

Filter Rail: State select (50 states + “All states”), outcome toggle, week slider

KPI Ribbon: 4 responsive cards with sparklines

US Choropleth: Hover tooltip + click-to-zoom and zoom-out behavior

National Timeline: Cases, deaths, vaccination coverage; brush/markers planned

Accessible defaults: Focus rings, color-blind-safe palette, labeled legends

🧰 Tech Stack
System & Tooling

macOS 12.0.1 (arm64), Node v24.11.0, npm 11.6.1

Homebrew 4.6.20, VS Code 1.105.1 (arm64)

App Framework

React 19.2.0, react-dom 19.2.0

Vite 7.2.2, TypeScript 5.9.3, @vitejs/plugin-react 5.1.0

typescript-eslint 8.46.4

Styling

Tailwind CSS 3.4.13, PostCSS 8.5.6, Autoprefixer 10.4.22

Global styles: src/styles/globals.css

State

Zustand 5.0.8

Visualization

Recharts 3.4.1 (KPI sparklines + National Timeline)

dayjs 1.11.19 (date formatting)

Mapping

d3 7.9.0 (includes d3-geo 3.1.1)

topojson-client 3.1.0

Asset: public/data/states-10m.json (US states TopoJSON)

UI Primitives & Icons

Local “shadcn-style” primitives in src/components/ui (Button, Card, Label, Separator, Sparkline)

Radix UI (installed):
@radix-ui/react-select 2.2.6, @radix-ui/react-slider 1.3.6, @radix-ui/react-tabs 1.1.13,
@radix-ui/react-popover 1.1.15, @radix-ui/react-dropdown-menu 2.1.16,
@radix-ui/react-dialog 1.1.15, @radix-ui/react-hover-card 1.1.15,
@radix-ui/react-toggle-group 1.1.11

class-variance-authority 0.7.1, lucide-react 0.553.0

📦 Project Structure
public/
  data/
    states-10m.json       # TopoJSON (served statically)
src/
  components/
    ui/                   # Reusable “shadcn-style” primitives (barrel-exported via ui/index.ts)
      button.tsx
      card.tsx
      chart.tsx
      label.tsx
      separator.tsx
      select.tsx
      slider.tsx
      index.ts
    GlobalNav.tsx
    FilterRail.tsx
    KpiRibbon.tsx
    NationalTimeline.tsx
    UsChoropleth.tsx
  lib/
    types.ts
    mock.ts               # Mock KPIs/timeline/state-latest used until real data is embedded
    utils.ts
  store/
    useAppStore.ts        # outcome, state, week, resetAll, etc.
  App.tsx
  main.tsx
styles/
  globals.css
index.html
tailwind.config.js

🔧 Setup

Requires Node ≥ 18 (you’re on Node 24.11.0) and npm.

# clone your repo
git clone https://github.com/Burned357Waffles/CSC-805-Group-Visualization-Project.git
cd CSC-805-Group-Visualization-Project

# install dependencies
npm install

# put the TopoJSON where the app serves it
mkdir -p public/data
# copy or download your file into public/data
# e.g.: cp ~/Desktop/states-10m.json public/data/states-10m.json

# start dev server
npm run dev


Open the printed local URL (usually http://localhost:5173
).

🚀 Build & Preview
# type check (optional but recommended)
npm run typecheck   # or: npx tsc --noEmit

# production build
npm run build

# preview the build locally
npm run preview


The optimized output will be in dist/.

📁 Data Ingestion (when switching from mock to real)

The app is currently wired to mock data in src/lib/mock.ts (KPIs, national timeline, state latest).

When your cleaned CSVs are ready, replace the mock loaders with your embedded data transforms:

Normalize to weekly and per-100k (already baked into your pipeline).

Expose derived series using the same field names the components expect:

cases_per_100k, deaths_per_100k, vaccination_any_pct, vaccination_primary_pct, vaccination_booster_pct, hesitancy_pct, etc.

Feed those into Zustand (useAppStore) so all visuals respond to state, outcome, and week.

No runtime fetch is required—datasets can ship in the bundle or as static assets in public/.

🧪 Development Tips

After installing new packages, restart the dev server (Ctrl+C, then npm run dev).

Keep src/components/ui/index.ts exporting only the primitives you actually have files for.

Use the store (useAppStore) for cross-component sync (state select, week slider, outcome toggle).

VS Code extensions that help:

Tailwind CSS IntelliSense

ES Lint (optional if you enable eslint config)

Prettier (optional)

🛟 Troubleshooting

“Module not found” for a UI primitive
Ensure the corresponding file exists in src/components/ui/ and is exported in ui/index.ts.
If it’s a Radix-backed component, verify the package is installed and the wrapper file exists.

TopoJSON not found
Confirm public/data/states-10m.json exists (correct casing and path). Access it directly in the browser:
http://localhost:5173/data/states-10m.json

Type errors
Run npm run typecheck to see exactly where. (Add that script if it isn’t present.)